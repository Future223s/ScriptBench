from __future__ import annotations
from collections import defaultdict
from itertools import islice
from pathlib import Path as FilePath
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend.api.dependencies import get_engine, row_to_dict
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
from backend.database.repositories.workflow_samples_repository import (
    WorkflowSamplesRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.core.workflow_config import WorkflowConfig
from backend.services.gemini import GeminiClient
from backend.services.prompt_resolution import PromptResolutionService

router = APIRouter(tags=["workspaces"])


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


async def _create_all_transcription_jobs(
    *,
    workflow_id: int,
    workflow_stage: str,
    engine,
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    workflow_samples_repository = WorkflowSamplesRepository(engine)
    samples_repository = SamplesRepository(engine)
    sample_uploads_repository = SampleUploadsRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None or str(workflow_row["workflow_stage"]) != workflow_stage:
        raise HTTPException(status_code=404, detail="Workflow not found")

    prompt_spec = workflow_row["prompt_spec"]
    if not isinstance(prompt_spec, dict):
        raise HTTPException(status_code=500, detail="Workflow prompt_spec is invalid")

    workflow_groups = _workflow_groups(workflow_row.get("groups"))

    workflow_sample_ids = workflow_samples_repository.fetch_workflow_samples(
        workflow_id=workflow_id,
        workflow_stage=workflow_stage,
    )
    if not workflow_sample_ids:
        raise HTTPException(status_code=400, detail="Workflow has no sample_ids configured")

    sample_rows_by_id: dict[str, Any] = {}
    for sample_id in workflow_sample_ids:
        row = samples_repository.fetch_sample(sample_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Sample not found: {sample_id}")
        sample_rows_by_id[sample_id] = row

    batch_size = _prompt_batch_size(prompt_spec)
    created_jobs: list[dict[str, object]] = []

    if workflow_groups:
        grouped_sample_ids: dict[tuple[tuple[str, str], ...], list[str]] = defaultdict(list)
        for sample_id in workflow_sample_ids:
            group_membership = _sample_group_membership(sample_rows_by_id[sample_id], workflow_groups)
            if group_membership is None:
                continue
            grouped_sample_ids[group_membership].append(sample_id)

        for group_membership, sample_ids in grouped_sample_ids.items():
            for batch_index, batch_sample_ids in enumerate(_chunked(sample_ids, batch_size), start=1):
                job_payload = await _create_transcription_job(
                    workflow_id=workflow_id,
                    workflow_stage=workflow_stage,
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
                created_jobs.append(job_payload)
    else:
        for batch_index, batch_sample_ids in enumerate(_chunked(workflow_sample_ids, batch_size), start=1):
            job_payload = await _create_transcription_job(
                workflow_id=workflow_id,
                workflow_stage=workflow_stage,
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
            created_jobs.append(job_payload)

    return {
        "workflow_id": workflow_id,
        "workflow_stage": workflow_stage,
        "workflow_groups": workflow_groups,
        "batch_size": batch_size,
        "job_count": len(created_jobs),
        "jobs": created_jobs,
    }


@router.get("/api/workspaces/{workflow_id}")
def get_workspace(
    workflow_id: int = Path(..., ge=1),
    workflow_stage: str = Query(...),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    samples_repository = SamplesRepository(engine)
    workflow_samples_repository = WorkflowSamplesRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    transcriptions_repository = TranscriptionsRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None or str(workflow_row["workflow_stage"]) != workflow_stage:
        raise HTTPException(status_code=404, detail="Workflow not found")

    sample_ids = workflow_samples_repository.fetch_workflow_samples(
        workflow_id=workflow_id,
        workflow_stage=workflow_stage,
    )

    sample_rows = []
    if sample_ids:
        sample_rows = [
            row
            for sample_id in sample_ids
            if (row := samples_repository.fetch_sample(sample_id)) is not None
        ]
    sample_row_map = {
        str(row["sample_id"]): row_to_dict(row, exclude={"sample_blob"})
        for row in sample_rows
    }
    ordered_samples = []
    for sample_id in sample_ids:
        sample_payload = sample_row_map.get(sample_id)
        if sample_payload is not None:
            ordered_samples.append(sample_payload)

    open_job_rows = transcription_jobs_repository.fetch_open_transcription_jobs_for_workflow(
        workflow_id
    )
    completed_job_rows = (
        transcription_jobs_repository.fetch_completed_transcription_jobs_for_workflow(
            workflow_id
        )
    )
    job_rows = list(open_job_rows) + list(completed_job_rows)
    all_jobs = []
    for job_row in job_rows:
        job_payload = row_to_dict(job_row)
        job_payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
            int(job_row["job_id"])
        )
        all_jobs.append(job_payload)
    pending_jobs, queued_jobs, completed_jobs = _split_jobs_by_status(all_jobs)

    transcription_rows = transcriptions_repository.fetch_transcriptions_for_workflow(
        workflow_id
    )
    transcriptions_payload = [row_to_dict(row) for row in transcription_rows]

    return {
        "workflow": row_to_dict(workflow_row),
        "samples": ordered_samples,
        "open_jobs": pending_jobs + queued_jobs,
        "pending_jobs": pending_jobs,
        "queued_jobs": queued_jobs,
        "completed_jobs": completed_jobs,
        "transcriptions": transcriptions_payload,
    }


@router.post("/api/workspaces/{workflow_id}/opened")
def mark_workspace_opened(
    workflow_id: int = Path(..., ge=1),
    workflow_stage: str = Query(...),
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None or str(workflow_row["workflow_stage"]) != workflow_stage:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflows_repository.mark_workflow_opened(workflow_id)
    refreshed_row = workflows_repository.fetch_workflow(workflow_id)
    if refreshed_row is None:
        raise HTTPException(status_code=500, detail="Failed to refresh workflow after update")

    return {
        "workflow_id": workflow_id,
        "workflow_stage": workflow_stage,
        "updated_at": row_to_dict(refreshed_row)["updated_at"],
    }


@router.post("/api/workspaces/{workflow_id}/jobs")
async def create_workspace_jobs(
    workflow_id: int = Path(..., ge=1),
    workflow_stage: str = Query(...),
    engine=Depends(get_engine),
) -> dict[str, object]:
    return await _create_all_transcription_jobs(
        workflow_id=workflow_id,
        workflow_stage=workflow_stage,
        engine=engine,
    )
