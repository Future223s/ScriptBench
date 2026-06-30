from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from itertools import islice
from pathlib import Path as FilePath
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from backend.api.dependencies import get_engine, get_job_event_hub, row_to_dict
from backend.api.routes.prompt_spec import PromptSpec
from backend.core.workflow_config import WorkflowConfig
from backend.database.repositories.sample_set_samples_repository import (
    SampleSetSamplesRepository,
)
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.sample_uploads_repository import (
    SampleUploadsRepository,
)
from backend.database.repositories.samples_repository import SamplesRepository
from backend.database.repositories.transcription_job_samples_repository import (
    TranscriptionJobSamplesRepository,
)
from backend.database.repositories.transcription_jobs_repository import (
    TranscriptionJobsRepository,
)
from backend.database.repositories.transcriptions_repository import (
    TranscriptionsRepository,
)
from backend.database.repositories.workflow_metrics_repository import (
    WorkflowMetricsRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.services.gemini import GeminiClient
from backend.services.job_events import JobEventHub, build_job_event
from backend.services.prompt_resolution import PromptResolutionService
from backend.services.scoring_client import ScoringClient

router = APIRouter(tags=["workflows-v1"])


class WorkflowCreateRequest(BaseModel):
    workflow_name: str
    workflow_stage: str
    sample_set_id: int = Field(validation_alias=AliasChoices("sample_set_id", "sampleSetId"))
    model_family: str
    model: str | None = None
    workflow_groups: list[str] = Field(default_factory=list, alias="groups")
    prompt_spec: PromptSpec
    status: str = "draft"

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class JobTransitionRequest(BaseModel):
    job_ids: list[int] | None = None

    model_config = ConfigDict(extra="forbid")


def _unique_preserve_order(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if str(value).strip()))


def _workflow_groups(raw_groups: Any) -> list[str]:
    if raw_groups is None:
        return []

    if isinstance(raw_groups, str):
        text = raw_groups.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except Exception:
            return [text]
        if isinstance(parsed, list):
            return _unique_preserve_order([str(group) for group in parsed])
        parsed_text = str(parsed).strip()
        return [parsed_text] if parsed_text else []

    if isinstance(raw_groups, list):
        return _unique_preserve_order([str(group) for group in raw_groups])

    if isinstance(raw_groups, tuple):
        return _unique_preserve_order([str(group) for group in raw_groups])

    parsed_text = str(raw_groups).strip()
    return [parsed_text] if parsed_text else []


def _chunked(values: list[str], batch_size: int) -> list[list[str]]:
    batches: list[list[str]] = []
    iterator = iter(values)
    while True:
        batch = list(islice(iterator, batch_size))
        if not batch:
            break
        batches.append(batch)
    return batches


def _sample_group_membership(
    sample_row: Any,
    workflow_groups: list[str],
) -> tuple[tuple[str, str], ...] | None:
    if not workflow_groups:
        return tuple()

    sample_groups = sample_row["sample_groups"] or {}
    if not isinstance(sample_groups, dict):
        return None

    group_membership: list[tuple[str, str]] = []
    for group_name in workflow_groups:
        group_value = sample_groups.get(group_name)
        group_value_text = str(group_value).strip() if group_value is not None else ""
        if not group_value_text:
            return None
        group_membership.append((group_name, group_value_text))

    return tuple(group_membership)


def _group_label(group_membership: tuple[tuple[str, str], ...]) -> tuple[str, str]:
    if not group_membership:
        return "", ""
    if len(group_membership) == 1:
        return group_membership[0]

    group_name = ", ".join(group_name for group_name, _ in group_membership)
    group_value = " | ".join(
        f"{group_name}: {group_value}" for group_name, group_value in group_membership
    )
    return group_name, group_value


def _prompt_batch_size(prompt_spec: dict[str, Any]) -> int:
    inputs = prompt_spec.get("inputs")
    if isinstance(inputs, dict):
        selection_mode = str(inputs.get("selection_mode", "batch")).strip().lower()
        if selection_mode == "single":
            return 1
        batch_size = inputs.get("batch_size", 5)
        if isinstance(batch_size, int) and batch_size > 0:
            return batch_size
    return 5


def _prompt_example_asset_ids(prompt_spec: dict[str, Any]) -> list[str]:
    examples = prompt_spec.get("examples")
    if not isinstance(examples, list):
        return []

    asset_ids: list[str] = []
    for example in examples:
        if not isinstance(example, dict):
            continue
        assets = example.get("assets", [])
        if not isinstance(assets, list):
            continue
        for asset_id in assets:
            asset_id_text = str(asset_id).strip()
            if asset_id_text and asset_id_text not in asset_ids:
                asset_ids.append(asset_id_text)
    return asset_ids


def _sample_payload_from_row(row: Any) -> tuple[bytes, str | None]:
    sample_blob = row["sample_blob"]
    if sample_blob is None:
        raise ValueError(f"Sample '{row['sample_id']}' is missing image bytes")
    mime_type = row["sample_mime_type"]
    return bytes(sample_blob), str(mime_type) if mime_type is not None else None


def _split_jobs_by_status(jobs: list[dict[str, object]]) -> tuple[
    list[dict[str, object]],
    list[dict[str, object]],
    list[dict[str, object]],
]:
    pending_jobs: list[dict[str, object]] = []
    queued_jobs: list[dict[str, object]] = []
    completed_jobs: list[dict[str, object]] = []

    for job in jobs:
        status = str(job.get("status", "")).strip().lower()
        if status == "pending":
            pending_jobs.append(job)
        elif status in {"queued", "running"}:
            queued_jobs.append(job)
        else:
            completed_jobs.append(job)

    return pending_jobs, queued_jobs, completed_jobs


def _split_job_output(raw_content: str | None) -> list[str] | None:
    if raw_content is None:
        return None
    try:
        parsed = json.loads(raw_content)
    except Exception:
        return None
    if isinstance(parsed, list):
        return [json.dumps(item) if isinstance(item, (dict, list)) else str(item) for item in parsed]
    return None


def _join_ground_truth(sample_rows: list[Any]) -> str:
    parts: list[str] = []
    for row in sample_rows:
        text = row["ground_truth_text"]
        if text is not None:
            parts.append(str(text))
    return "\n".join(parts)


async def _create_transcription_job(
    *,
    workflow_id: int,
    workflow_stage: str,
    workflow_row: dict[str, Any],
    prompt_spec: dict[str, Any],
    batch_sample_ids: list[str],
    group_membership: tuple[tuple[str, str], ...],
    batch_index: int,
    samples_repository: SamplesRepository,
    sample_uploads_repository: SampleUploadsRepository,
    transcription_jobs_repository: TranscriptionJobsRepository,
    transcription_job_samples_repository: TranscriptionJobSamplesRepository,
) -> dict[str, object]:
    required_sample_ids = _unique_preserve_order(
        batch_sample_ids + _prompt_example_asset_ids(prompt_spec)
    )

    sample_payloads_by_sample_id: dict[str, tuple[bytes, str | None]] = {}
    for sample_id in required_sample_ids:
        row = samples_repository.fetch_sample(sample_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Sample not found: {sample_id}")
        sample_payloads_by_sample_id[sample_id] = _sample_payload_from_row(row)

    workflow_config = WorkflowConfig(
        workflow_name=str(workflow_row["workflow_name"]),
        stage=str(workflow_stage),
        model_family=str(workflow_row["model_family"]),
        model=str(workflow_row["model"]) if workflow_row["model"] is not None else None,
        example_ids=tuple(_prompt_example_asset_ids(prompt_spec)),
        test_ids=tuple(batch_sample_ids),
        status=str(workflow_row["status"]),
        prompt_template=prompt_spec,
        workflow_id=workflow_id,
    )

    client = GeminiClient(workflow_config=workflow_config, image_dir=FilePath("."))
    prompt_resolution_service = PromptResolutionService(
        workflow_config=workflow_config,
        provider=client,
        sample_uploads_repository=sample_uploads_repository,
    )
    prompt_payload = await prompt_resolution_service.resolve_prompt(
        prompt_spec=prompt_spec,
        sample_payloads_by_sample_id=sample_payloads_by_sample_id,
        sample_ids=batch_sample_ids,
    )

    group_name, group_value = _group_label(group_membership)

    job_id = transcription_jobs_repository.insert_transcription_job(
        workflow_id=workflow_id,
        resolved_prompt=prompt_payload["resolved_prompt"],
        status="pending",
    )
    transcription_job_samples_repository.add_transcription_job_samples(
        int(job_id),
        batch_sample_ids,
    )

    job_row = transcription_jobs_repository.fetch_transcription_job(int(job_id))
    if job_row is None:
        raise HTTPException(status_code=500, detail="Failed to load job after enqueue")

    job_payload = row_to_dict(job_row)
    job_payload["group_name"] = group_name
    job_payload["group_value"] = group_value
    job_payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
        int(job_id)
    )
    return job_payload


def _create_all_transcription_jobs(
    *,
    workflow_id: int,
    workflow_row: dict[str, Any],
    prompt_spec: dict[str, Any],
    sample_ids: list[str],
    engine,
) -> dict[str, object]:
    samples_repository = SamplesRepository(engine)
    sample_uploads_repository = SampleUploadsRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)

    workflow_groups = _workflow_groups(workflow_row.get("groups"))
    batch_size = _prompt_batch_size(prompt_spec)
    created_jobs: list[dict[str, object]] = []

    sample_rows_by_id: dict[str, Any] = {}
    for sample_id in sample_ids:
        row = samples_repository.fetch_sample(sample_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Sample not found: {sample_id}")
        sample_rows_by_id[sample_id] = row

    if workflow_groups:
        grouped_sample_ids: dict[tuple[tuple[str, str], ...], list[str]] = defaultdict(list)
        for sample_id in sample_ids:
            group_membership = _sample_group_membership(sample_rows_by_id[sample_id], workflow_groups)
            if group_membership is None:
                continue
            grouped_sample_ids[group_membership].append(sample_id)

        for group_membership, grouped_ids in grouped_sample_ids.items():
            for batch_index, batch_sample_ids in enumerate(_chunked(grouped_ids, batch_size), start=1):
                job_payload = asyncio.run(
                    _create_transcription_job(
                        workflow_id=workflow_id,
                        workflow_stage=str(workflow_row["workflow_stage"]),
                        workflow_row=dict(workflow_row),
                        prompt_spec=prompt_spec,
                        batch_sample_ids=batch_sample_ids,
                        group_membership=group_membership,
                        batch_index=batch_index,
                        samples_repository=samples_repository,
                        sample_uploads_repository=sample_uploads_repository,
                        transcription_jobs_repository=transcription_jobs_repository,
                        transcription_job_samples_repository=transcription_job_samples_repository,
                    )
                )
                created_jobs.append(job_payload)
    else:
        for batch_index, batch_sample_ids in enumerate(_chunked(sample_ids, batch_size), start=1):
            job_payload = asyncio.run(
                _create_transcription_job(
                    workflow_id=workflow_id,
                    workflow_stage=str(workflow_row["workflow_stage"]),
                    workflow_row=dict(workflow_row),
                    prompt_spec=prompt_spec,
                    batch_sample_ids=batch_sample_ids,
                    group_membership=tuple(),
                    batch_index=batch_index,
                    samples_repository=samples_repository,
                    sample_uploads_repository=sample_uploads_repository,
                    transcription_jobs_repository=transcription_jobs_repository,
                    transcription_job_samples_repository=transcription_job_samples_repository,
                )
            )
            created_jobs.append(job_payload)

    return {
        "workflow_id": workflow_id,
        "workflow_stage": str(workflow_row["workflow_stage"]),
        "workflow_groups": workflow_groups,
        "batch_size": batch_size,
        "job_count": len(created_jobs),
        "jobs": created_jobs,
    }


def _job_payload(
    *,
    job_row,
    transcription_job_samples_repository: TranscriptionJobSamplesRepository,
) -> dict[str, object]:
    payload = row_to_dict(job_row)
    payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
        int(job_row["job_id"])
    )
    return payload


def _publish_job_event(
    *,
    job_event_hub: JobEventHub | None,
    event: str,
    message: str,
    job_payload: dict[str, object],
) -> None:
    if job_event_hub is None:
        return
    job_event_hub.broadcast_threadsafe(
        build_job_event(event=event, message=message, job_payload=job_payload)
    )


def _workflow_workspace_payload(
    *,
    workflow_row,
    sample_ids: list[str],
    open_job_rows: list[Any],
    completed_job_rows: list[Any],
    transcription_rows: list[Any],
    transcription_job_samples_repository: TranscriptionJobSamplesRepository,
) -> dict[str, object]:
    job_rows = list(open_job_rows) + list(completed_job_rows)
    all_jobs = []
    for job_row in job_rows:
        job_payload = _job_payload(
            job_row=job_row,
            transcription_job_samples_repository=transcription_job_samples_repository,
        )
        all_jobs.append(job_payload)
    pending_jobs, queued_jobs, completed_jobs = _split_jobs_by_status(all_jobs)
    return {
        "workflow": row_to_dict(workflow_row),
        "sample_ids": sample_ids,
        "pending_jobs": pending_jobs,
        "queued_jobs": queued_jobs,
        "completed_jobs": completed_jobs,
        "transcriptions": [row_to_dict(row) for row in transcription_rows],
    }


def _assemble_transcriptions_for_job(
    *,
    workflow_row,
    job_row,
    sample_rows_by_id: dict[str, Any],
    transcription_index_start: int,
    transcriptions_repository: TranscriptionsRepository,
) -> list[dict[str, object]]:
    job_id = int(job_row["job_id"])
    job_sample_ids = [str(sample_id) for sample_id in job_row.get("sample_ids", [])]
    raw_content = job_row.get("raw_content")
    status = str(job_row.get("status", "")).strip().lower()
    workflow_groups = _workflow_groups(workflow_row.get("groups"))
    parsed_outputs = _split_job_output(raw_content if isinstance(raw_content, str) else None)

    created_rows: list[dict[str, object]] = []
    if status == "failed" or raw_content is None:
        transcription_text = f"MODEL ERROR FOR {', '.join(job_sample_ids)}"
        transcription_id = transcriptions_repository.upsert_transcription(
            workflow_id=int(workflow_row["workflow_id"]),
            sample_id=f"job:{job_id}",
            transcription_text=transcription_text,
            job_id=job_id,
            sample_set_id=workflow_row.get("sample_set_id"),
            sample_ids=job_sample_ids,
            output_index=transcription_index_start,
        )
        created_rows.append(
            {
                "transcription_id": transcription_id,
                "workflow_id": int(workflow_row["workflow_id"]),
                "job_id": job_id,
                "sample_id": f"job:{job_id}",
                "sample_ids": job_sample_ids,
                "group_name": None,
                "group_value": None,
                "output_index": transcription_index_start,
                "transcription_text": transcription_text,
            }
        )
        return created_rows

    if parsed_outputs is None:
        transcription_text = str(raw_content)
        transcription_id = transcriptions_repository.upsert_transcription(
            workflow_id=int(workflow_row["workflow_id"]),
            sample_id=f"job:{job_id}",
            transcription_text=transcription_text,
            job_id=job_id,
            sample_set_id=workflow_row.get("sample_set_id"),
            sample_ids=job_sample_ids,
            output_index=transcription_index_start,
        )
        created_rows.append(
            {
                "transcription_id": transcription_id,
                "workflow_id": int(workflow_row["workflow_id"]),
                "job_id": job_id,
                "sample_id": f"job:{job_id}",
                "sample_ids": job_sample_ids,
                "group_name": None,
                "group_value": None,
                "output_index": transcription_index_start,
                "transcription_text": transcription_text,
            }
        )
        return created_rows

    if workflow_groups:
        group_name = workflow_groups[0]
        grouped_texts: dict[str, list[str]] = defaultdict(list)
        grouped_sample_ids: dict[str, list[str]] = defaultdict(list)
        for sample_id, output_text in zip(job_sample_ids, parsed_outputs):
            sample_row = sample_rows_by_id.get(sample_id)
            if sample_row is None:
                continue
            sample_groups = sample_row["sample_groups"] or {}
            if not isinstance(sample_groups, dict):
                continue
            group_value = sample_groups.get(group_name)
            if group_value is None:
                continue
            group_value_text = str(group_value).strip()
            if not group_value_text:
                continue
            grouped_texts[group_value_text].append(output_text)
            grouped_sample_ids[group_value_text].append(sample_id)

        for group_index, (group_value, texts) in enumerate(grouped_texts.items(), start=transcription_index_start):
            transcription_text = "\n".join(texts)
            synthetic_sample_id = f"group:{group_name}:{group_value}:job:{job_id}"
            transcription_id = transcriptions_repository.upsert_transcription(
                workflow_id=int(workflow_row["workflow_id"]),
                sample_id=synthetic_sample_id,
                transcription_text=transcription_text,
                job_id=job_id,
                sample_set_id=workflow_row.get("sample_set_id"),
                sample_ids=grouped_sample_ids[group_value],
                group_name=group_name,
                group_value=group_value,
                output_index=group_index,
            )
            created_rows.append(
                {
                    "transcription_id": transcription_id,
                    "workflow_id": int(workflow_row["workflow_id"]),
                    "job_id": job_id,
                    "sample_id": synthetic_sample_id,
                    "sample_ids": grouped_sample_ids[group_value],
                    "group_name": group_name,
                    "group_value": group_value,
                    "output_index": group_index,
                    "transcription_text": transcription_text,
                }
            )
        return created_rows

    for output_index, (sample_id, output_text) in enumerate(zip(job_sample_ids, parsed_outputs), start=transcription_index_start):
        transcription_id = transcriptions_repository.upsert_transcription(
            workflow_id=int(workflow_row["workflow_id"]),
            sample_id=sample_id,
            transcription_text=output_text,
            job_id=job_id,
            sample_set_id=workflow_row.get("sample_set_id"),
            sample_ids=[sample_id],
            output_index=output_index,
        )
        created_rows.append(
            {
                "transcription_id": transcription_id,
                "workflow_id": int(workflow_row["workflow_id"]),
                "job_id": job_id,
                "sample_id": sample_id,
                "sample_ids": [sample_id],
                "group_name": None,
                "group_value": None,
                "output_index": output_index,
                "transcription_text": output_text,
            }
        )
    return created_rows


@router.get("/api/v1/workflows")
def list_workflows(engine=Depends(get_engine)) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)

    workflow_rows = workflows_repository.list_workflows()
    payload = []
    for workflow_row in workflow_rows:
        workflow_payload = row_to_dict(workflow_row)
        sample_set_id = workflow_row["sample_set_id"]
        if sample_set_id is not None:
            sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(int(sample_set_id))
            workflow_payload["sample_ids"] = sample_ids[:5]
            workflow_payload["sample_count"] = len(sample_ids)
        payload.append(workflow_payload)

    return {
        "workflows": payload,
        "workflow_count": len(payload),
    }


@router.post("/api/v1/workflows")
def create_workflow(
    payload: WorkflowCreateRequest,
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_sets_repository = SampleSetsRepository(engine)
    sample_set = sample_sets_repository.fetch_sample_set(payload.sample_set_id)
    if sample_set is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    workflow_id = workflows_repository.insert_workflow(
        workflow_name=payload.workflow_name,
        workflow_stage=payload.workflow_stage,
        sample_set_id=payload.sample_set_id,
        model_family=payload.model_family,
        model=payload.model,
        groups=payload.workflow_groups,
        status=payload.status,
        prompt_spec=payload.prompt_spec.model_dump(),
    )

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=500, detail="Failed to load workflow after create")

    workflow_payload = row_to_dict(workflow_row)
    workflow_payload["workflow_groups"] = workflow_payload.get("groups", [])
    return workflow_payload


@router.delete("/api/v1/workflows/{workflow_id}")
def delete_workflow(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    existing_workflow = workflows_repository.fetch_workflow(workflow_id)
    if existing_workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflows_repository.delete_workflow(workflow_id)
    return {"workflow_id": workflow_id, "deleted": True}


@router.get("/api/v1/workflows/{workflow_id}/workspace")
def get_workspace(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    transcriptions_repository = TranscriptionsRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    sample_set_id = workflow_row["sample_set_id"]
    if sample_set_id is None:
        raise HTTPException(status_code=400, detail="Workflow is not attached to a sample set")

    sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(int(sample_set_id))

    open_job_rows = transcription_jobs_repository.fetch_open_transcription_jobs_for_workflow(
        workflow_id
    )
    completed_job_rows = transcription_jobs_repository.fetch_completed_transcription_jobs_for_workflow(
        workflow_id
    )
    transcription_rows = transcriptions_repository.fetch_transcriptions_for_workflow(workflow_id)
    return _workflow_workspace_payload(
        workflow_row=workflow_row,
        sample_ids=sample_ids,
        open_job_rows=open_job_rows,
        completed_job_rows=completed_job_rows,
        transcription_rows=transcription_rows,
        transcription_job_samples_repository=transcription_job_samples_repository,
    )


@router.post("/api/v1/workflows/{workflow_id}/workspace/jobs")
@router.post("/api/v1/workflows/{workflow_id}/jobs")
def create_workspace_jobs(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    sample_sets_repository = SampleSetsRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    sample_set_id = workflow_row["sample_set_id"]
    if sample_set_id is None:
        raise HTTPException(status_code=400, detail="Workflow is not attached to a sample set")

    sample_set_row = sample_sets_repository.fetch_sample_set(int(sample_set_id))
    if sample_set_row is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    prompt_spec = workflow_row["prompt_spec"]
    if not isinstance(prompt_spec, dict):
        raise HTTPException(status_code=500, detail="Workflow prompt_spec is invalid")

    sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(int(sample_set_id))
    if not sample_ids:
        raise HTTPException(status_code=400, detail="Sample set has no sample_ids configured")

    return _create_all_transcription_jobs(
        workflow_id=workflow_id,
        workflow_row=dict(workflow_row),
        prompt_spec=prompt_spec,
        sample_ids=sample_ids,
        engine=engine,
    )


@router.patch("/api/v1/workflows/{workflow_id}/workspace/jobs/queue")
def queue_workspace_jobs(
    payload: JobTransitionRequest,
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
    job_event_hub: JobEventHub | None = Depends(get_job_event_hub),
) -> dict[str, object]:
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    existing_jobs = transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    available_job_ids = {int(job["job_id"]) for job in existing_jobs}
    if payload.job_ids is None or payload.job_ids == []:
        selected_job_ids = [int(job["job_id"]) for job in existing_jobs]
    else:
        selected_job_ids = [int(job_id) for job_id in payload.job_ids]
        missing_job_ids = [job_id for job_id in selected_job_ids if job_id not in available_job_ids]
        if missing_job_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown job_id(s): {', '.join(str(job_id) for job_id in missing_job_ids)}",
            )
    if not selected_job_ids:
        return {"workflow_id": workflow_id, "job_count": 0, "updated_job_ids": [], "status": "queued"}

    for job_id in selected_job_ids:
        transcription_jobs_repository.update_transcription_job(
            job_id,
            status="queued",
        )
        refreshed_job = transcription_jobs_repository.fetch_transcription_job(job_id)
        if refreshed_job is not None:
            _publish_job_event(
                job_event_hub=job_event_hub,
                event="job.queued",
                message="Job queued.",
                job_payload=_job_payload(
                    job_row=refreshed_job,
                    transcription_job_samples_repository=TranscriptionJobSamplesRepository(engine),
                ),
            )

    return {
        "workflow_id": workflow_id,
        "job_count": len(selected_job_ids),
        "updated_job_ids": selected_job_ids,
        "status": "queued",
    }


@router.patch("/api/v1/workflows/{workflow_id}/workspace/jobs/retry")
def retry_workspace_jobs(
    payload: JobTransitionRequest,
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
    job_event_hub: JobEventHub | None = Depends(get_job_event_hub),
) -> dict[str, object]:
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    existing_jobs = transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    available_job_ids = {int(job["job_id"]) for job in existing_jobs}
    if payload.job_ids is None or payload.job_ids == []:
        selected_job_ids = [int(job["job_id"]) for job in existing_jobs]
    else:
        selected_job_ids = [int(job_id) for job_id in payload.job_ids]
        missing_job_ids = [job_id for job_id in selected_job_ids if job_id not in available_job_ids]
        if missing_job_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown job_id(s): {', '.join(str(job_id) for job_id in missing_job_ids)}",
            )
    if not selected_job_ids:
        return {"workflow_id": workflow_id, "job_count": 0, "updated_job_ids": [], "status": "pending"}

    for job_id in selected_job_ids:
        transcription_jobs_repository.update_transcription_job(
            job_id,
            status="pending",
            raw_content=None,
            failure_reason=None,
            started_at=None,
            completed_at=None,
            time_elapsed=None,
        )
        refreshed_job = transcription_jobs_repository.fetch_transcription_job(job_id)
        if refreshed_job is not None:
            _publish_job_event(
                job_event_hub=job_event_hub,
                event="job.pending",
                message="Job moved back to pending.",
                job_payload=_job_payload(
                    job_row=refreshed_job,
                    transcription_job_samples_repository=TranscriptionJobSamplesRepository(engine),
                ),
            )

    return {
        "workflow_id": workflow_id,
        "job_count": len(selected_job_ids),
        "updated_job_ids": selected_job_ids,
        "status": "pending",
    }


@router.delete("/api/v1/workflows/{workflow_id}/workspace/jobs")
def delete_workspace_jobs(
    workflow_id: int = Path(..., ge=1),
    kind: str = Query("all"),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    kind_value = str(kind).strip().lower()
    try:
        deleted_counts = workflows_repository.delete_workspace_jobs(workflow_id, kind=kind_value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "workflow_id": workflow_id,
        "kind": kind_value,
        **deleted_counts,
    }


@router.get("/api/v1/workflows/{workflow_id}/workspace/jobs/{job_id}")
@router.get("/api/v1/workflows/{workflow_id}/jobs/{job_id}")
def get_workspace_job(
    workflow_id: int = Path(..., ge=1),
    job_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    job_row = transcription_jobs_repository.fetch_transcription_job(job_id)
    if job_row is None or int(job_row["workflow_id"]) != workflow_id:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    return _job_payload(
        job_row=job_row,
        transcription_job_samples_repository=transcription_job_samples_repository,
    )


@router.post("/api/v1/workflows/{workflow_id}/workspace/transcriptions")
@router.post("/api/v1/workflows/{workflow_id}/transcriptions")
def create_workspace_transcriptions(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    transcriptions_repository = TranscriptionsRepository(engine)
    samples_repository = SamplesRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    sample_set_id = workflow_row["sample_set_id"]
    if sample_set_id is None:
        raise HTTPException(status_code=400, detail="Workflow is not attached to a sample set")

    sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(int(sample_set_id))
    sample_rows_by_id: dict[str, Any] = {}
    for sample_id in sample_ids:
        sample_row = samples_repository.fetch_sample(sample_id)
        if sample_row is not None:
            sample_rows_by_id[sample_id] = sample_row

    job_rows = transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    created_transcriptions: list[dict[str, object]] = []
    transcription_index = 1
    for job_row in job_rows:
        job_with_samples = row_to_dict(job_row)
        job_with_samples["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
            int(job_row["job_id"])
        )
        created_rows = _assemble_transcriptions_for_job(
            workflow_row=workflow_row,
            job_row=job_with_samples,
            sample_rows_by_id=sample_rows_by_id,
            transcription_index_start=transcription_index,
            transcriptions_repository=transcriptions_repository,
        )
        created_transcriptions.extend(created_rows)
        transcription_index += max(1, len(created_rows))

    return {
        "workflow_id": workflow_id,
        "transcription_count": len(created_transcriptions),
        "transcriptions": created_transcriptions,
    }


@router.get("/api/v1/workflows/{workflow_id}/workspace/transcriptions/{transcription_id}")
@router.get("/api/v1/workflows/{workflow_id}/transcriptions/{transcription_id}")
def get_workspace_transcription(
    workflow_id: int = Path(..., ge=1),
    transcription_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    transcriptions_repository = TranscriptionsRepository(engine)
    samples_repository = SamplesRepository(engine)
    transcription_row = transcriptions_repository.fetch_transcription(transcription_id)
    if transcription_row is None or int(transcription_row["workflow_id"]) != workflow_id:
        raise HTTPException(status_code=404, detail="Transcription not found")

    sample_ids = [str(sample_id) for sample_id in transcription_row.get("sample_ids") or []]
    sample_rows = [
        row
        for sample_id in sample_ids
        if (row := samples_repository.fetch_sample(sample_id)) is not None
    ]

    return {
        "transcription": row_to_dict(transcription_row),
        "ground_truth_text": _join_ground_truth(sample_rows),
        "sample_ids": sample_ids,
    }


@router.post("/api/v1/workflows/{workflow_id}/workspace/score")
@router.post("/api/v1/workflows/{workflow_id}/score")
def score_workspace(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    transcriptions_repository = TranscriptionsRepository(engine)
    workflow_metrics_repository = WorkflowMetricsRepository(engine)
    samples_repository = SamplesRepository(engine)
    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    transcription_rows = transcriptions_repository.fetch_transcriptions_for_workflow(workflow_id)
    if not transcription_rows:
        raise HTTPException(status_code=400, detail="Workflow has no transcriptions to score")

    ground_truth_by_sample_id: dict[str, str] = {}
    for transcription_row in transcription_rows:
        sample_key = str(transcription_row["sample_id"] or f"transcription-{transcription_row['transcription_id']}")
        sample_ids = [str(sample_id) for sample_id in transcription_row.get("sample_ids") or []]
        sample_rows = [
            row
            for sample_id in sample_ids
            if (row := samples_repository.fetch_sample(sample_id)) is not None
        ]
        if sample_rows:
            ground_truth_by_sample_id[sample_key] = _join_ground_truth(sample_rows)
        elif transcription_row["sample_id"] is not None:
            sample_row = samples_repository.fetch_sample(str(transcription_row["sample_id"]))
            ground_truth_by_sample_id[sample_key] = (
                str(sample_row["ground_truth_text"]) if sample_row and sample_row["ground_truth_text"] is not None else ""
            )
        else:
            ground_truth_by_sample_id[sample_key] = ""

    scorer = ScoringClient(
        workflow_config=WorkflowConfig(
            workflow_name=str(workflow_row["workflow_name"]),
            stage=str(workflow_row["workflow_stage"]),
            model_family=str(workflow_row["model_family"]),
            model=str(workflow_row["model"]) if workflow_row["model"] is not None else None,
            workflow_id=workflow_id,
            prompt_template=workflow_row["prompt_spec"],
        ),
        evaluation_run_dir=FilePath("."),
    )
    run_results = scorer.score_outputs(
        workflow_row=workflow_row,
        transcription_rows=transcription_rows,
        ground_truth_by_sample_id=ground_truth_by_sample_id,
    )

    per_sample = run_results.get("per_sample", [])
    per_sample_by_id = {
        str(item["sample_id"]): item
        for item in per_sample
        if isinstance(item, dict) and "sample_id" in item
    }
    for transcription_row in transcription_rows:
        sample_key = str(transcription_row["sample_id"] or f"transcription-{transcription_row['transcription_id']}")
        metric_row = per_sample_by_id.get(sample_key)
        if metric_row is None:
            continue
        transcriptions_repository.update_transcription_metrics(
            int(transcription_row["transcription_id"]),
            cer=metric_row.get("cer"),
            wer=metric_row.get("wer"),
            hallucinations=metric_row.get("hallucination_count"),
            line_omission_count=metric_row.get("line_omission_count"),
            line_addition_count=metric_row.get("line_addition_count"),
            metrics=metric_row,
        )

    aggregate_metrics = run_results.get("aggregates", {}).get("all", {})
    workflow_metrics_repository.upsert_workflow_metrics(
        workflow_id=workflow_id,
        scorer=str(run_results.get("scorer", "align_and_score")),
        sample_count=len(transcription_rows),
        cer=aggregate_metrics.get("cer"),
        wer=aggregate_metrics.get("wer"),
        hallucinations=aggregate_metrics.get("hallucination_count"),
        line_omission_count=aggregate_metrics.get("line_omission_count"),
        line_addition_count=aggregate_metrics.get("line_addition_count"),
    )

    workflow_metrics_row = workflow_metrics_repository.fetch_workflow_metrics(workflow_id)
    return {
        "workflow_id": workflow_id,
        "run_results": run_results,
        "workflow_metrics": row_to_dict(workflow_metrics_row) if workflow_metrics_row is not None else None,
    }
