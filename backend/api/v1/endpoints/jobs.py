from __future__ import annotations

import asyncio
import json
from pathlib import Path as FilePath

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend.api.dependencies import get_engine, get_job_event_hub, row_to_dict, json_safe
from backend.core.workflow_config import WorkflowConfig
from backend.database.repositories.sample_set_samples_repository import SampleSetSamplesRepository
from backend.database.repositories.sample_uploads_repository import SampleUploadsRepository
from backend.database.repositories.samples_repository import SamplesRepository
from backend.database.repositories.transcription_job_samples_repository import TranscriptionJobSamplesRepository
from backend.database.repositories.transcription_jobs_repository import TranscriptionJobsRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.events import JobEventPayload
from backend.models.workflows import WorkspaceJobsResponse
from backend.models.prompt_spec import PromptSpec
from backend.services.gemini import GeminiClient
from backend.services.gemini_prompt_refresh import GeminiPromptRefreshService
from backend.services.prompt_resolution import PromptResolutionService
from backend.services.job_events import JobEventHub
from backend.models.jobs import JobTransitionRequest

router = APIRouter(tags=["transcription-jobs-v1"])

import logging
logger = logging.getLogger(__name__)

@router.post("/api/v1/workflows/{workflow_id}/workspace/jobs", response_model=WorkspaceJobsResponse)
def create_workspace_jobs(
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
    job_event_hub: JobEventHub | None = Depends(get_job_event_hub)
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    samples_repository = SamplesRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    sample_set_id = workflow_row["sample_set_id"]
    if sample_set_id is None:
        raise HTTPException(status_code=400, detail="Workflow is not attached to a sample set")

    prompt_spec = PromptSpec.model_validate(workflow_row["prompt_spec"])

    sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(int(sample_set_id))
    if not sample_ids:
        raise HTTPException(status_code=400, detail="Sample set has no sample_ids configured")
    logger.info(f"sample_ids: {sample_ids}")

    workflow_groups = [str(group).strip() for group in workflow_row["groups"] or [] if str(group).strip()]
    batch_size = 1 if prompt_spec.inputs.selection_mode == "single" else prompt_spec.inputs.batch_size
    sample_rows_by_id = {sample_id: samples_repository.fetch_sample(sample_id) for sample_id in sample_ids}
    missing_sample_id = next((sample_id for sample_id, sample_row in sample_rows_by_id.items() if sample_row is None), None)
    if missing_sample_id is not None:
        raise HTTPException(status_code=404, detail=f"Sample not found: {missing_sample_id}")
    existing_job_signatures = {
        tuple(transcription_job_samples_repository.fetch_transcription_job_samples(int(job_row["job_id"])))
        for job_row in transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    }
    batch_specs = []
    if workflow_groups:
        grouped_sample_ids = {}
        for sample_id in sample_ids:
            sample_groups = sample_rows_by_id[sample_id]["sample_groups"] or {}
            membership = []
            for group_name in workflow_groups:
                group_value = sample_groups.get(group_name)
                group_value_text = str(group_value).strip() if group_value is not None else ""
                if not group_value_text:
                    break
                membership.append((group_name, group_value_text))
            else:
                grouped_sample_ids.setdefault(tuple(membership), []).append(sample_id)
        batch_specs = [
            (membership, grouped_ids[index : index + batch_size])
            for membership, grouped_ids in grouped_sample_ids.items()
            for index in range(0, len(grouped_ids), batch_size)
        ]
    else:
        logger.info("sjsjdwkodjq")
        batch_specs = [(tuple(), sample_ids[index : index + batch_size]) for index in range(0, len(sample_ids), batch_size)]
    prompt_resolution_service = PromptResolutionService()

    logger.info(f"batch_specs: {batch_specs}")
    created_jobs = []
    for membership, batch_sample_ids in batch_specs:
        batch_signature = tuple(sorted(batch_sample_ids))
        if batch_signature in existing_job_signatures:
            continue

        prompt_payload = asyncio.run(
            prompt_resolution_service.resolve_prompt(
                prompt_spec=prompt_spec.model_dump(),
                sample_ids=batch_sample_ids,
            )
        )

        job_id = transcription_jobs_repository.insert_transcription_job(
            workflow_id=workflow_id,
            resolved_prompt=prompt_payload["resolved_prompt"],
            status="pending",
        )
        transcription_job_samples_repository.add_transcription_job_samples(int(job_id), batch_sample_ids)
        job_row = transcription_jobs_repository.fetch_transcription_job(int(job_id))
        if job_row is None:
            raise HTTPException(status_code=500, detail="Failed to load job after enqueue")

        job_payload = row_to_dict(job_row)
        job_payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(int(job_id))
        job_payload["group_name"] = membership[0][0] if len(membership) == 1 else ", ".join(group_name for group_name, _ in membership) if membership else None
        job_payload["group_value"] = membership[0][1] if len(membership) == 1 else " | ".join(f"{group_name}: {group_value}" for group_name, group_value in membership) if membership else None
        created_jobs.append(job_payload)
        existing_job_signatures.add(batch_signature)

        if job_event_hub is not None:
            job_event_hub.broadcast_threadsafe(
                JobEventPayload.build(
                    event="job.created",
                    message=f"Job {job_id} created.",
                    job_payload=job_payload,
                )
            )

    message = None if created_jobs else "No new jobs created; all jobs already exist."

    return {
        "workflow_id": workflow_id,
        "workflow_stage": str(workflow_row["workflow_stage"]),
        "workflow_groups": workflow_groups,
        "batch_size": batch_size,
        "job_count": len(created_jobs),
        "jobs": created_jobs,
        "message": message,
    }

def _job_payload(
    *,
    job_row,
    transcription_job_samples_repository: TranscriptionJobSamplesRepository,
) -> dict[str, object]:
    payload = {str(key): json_safe(value) for key, value in dict(job_row).items()}
    try:
        payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
            int(job_row["job_id"])
        )
    except Exception:
        payload["sample_ids"] = []
    return payload

@router.get("/api/v1/workflows/{workflow_id}/workspace/jobs/{job_id}")
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


@router.patch("/api/v1/workflows/{workflow_id}/workspace/jobs/queue")
def queue_workspace_jobs(
    payload: JobTransitionRequest,
    workflow_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
    job_event_hub: JobEventHub | None = Depends(get_job_event_hub),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    samples_repository = SamplesRepository(engine)
    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    existing_jobs = transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    available_job_ids = {int(job["job_id"]) for job in existing_jobs}
    if not payload.job_ids:
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

    workflow_config = WorkflowConfig(
        workflow_name=str(workflow_row["workflow_name"]),
        stage=str(workflow_row["workflow_stage"]),
        model_family=str(workflow_row["model_family"]),
        model=str(workflow_row["model"]) if workflow_row["model"] is not None else None,
        workflow_id=int(workflow_row["workflow_id"]),
        status=str(workflow_row["status"]),
        prompt_template=workflow_row["prompt_spec"],
    )
    prompt_refresher = GeminiPromptRefreshService(
        provider=GeminiClient(workflow_config=workflow_config, image_dir=FilePath(".")),
        sample_uploads_repository=SampleUploadsRepository(engine),
    )

    for job_id in selected_job_ids:
        job_row = transcription_jobs_repository.fetch_transcription_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail=f"Transcription job not found: {job_id}")
    
        resolved_prompt = job_row["resolved_prompt"]
        if isinstance(resolved_prompt, str):
            try:
                resolved_prompt = json.loads(resolved_prompt)
            except json.JSONDecodeError as error:
                raise HTTPException(
                    status_code=500,
                    detail="Transcription job resolved_prompt is invalid",
                ) from error
        if not isinstance(resolved_prompt, dict):
            raise HTTPException(status_code=500, detail="Transcription job resolved_prompt is invalid")

        sample_ids: list[str] = []
        contents = resolved_prompt.get("contents", [])
        # get sample_ids from transcription_job_samples table instead
        if isinstance(contents, list):
            for content in contents:
                if not isinstance(content, dict):
                    continue
                parts = content.get("parts", [])
                if not isinstance(parts, list):
                    continue
                for part in parts:
                    if not isinstance(part, dict):
                        continue
                    file_data = part.get("file_data")
                    if not isinstance(file_data, dict):
                        continue
                    sample_id = str(file_data.get("sample_id", "")).strip()
                    if sample_id:
                        sample_ids.append(sample_id)
        sample_ids = list(dict.fromkeys(sample_ids))

        # What are sample_pyalods_by_sample_id
        sample_payloads_by_sample_id: dict[str, tuple[bytes, str | None]] = {}
        for sample_id in sample_ids:
            sample_row = samples_repository.fetch_sample(sample_id)
            if sample_row is None:
                raise HTTPException(status_code=404, detail=f"Sample not found: {sample_id}")
            sample_blob = sample_row["sample_blob"]
            if sample_blob is None:
                raise HTTPException(status_code=500, detail=f"Sample '{sample_id}' is missing image bytes")
            sample_payloads_by_sample_id[sample_id] = (
                bytes(sample_blob),
                str(sample_row["sample_mime_type"]) if sample_row["sample_mime_type"] is not None else None,
            )


        refreshed_prompt = asyncio.run(
            prompt_refresher.refresh_resolved_prompt(
                resolved_prompt=resolved_prompt,
                sample_payloads_by_sample_id=sample_payloads_by_sample_id,
            )
        )
        ref_usage = refreshed_prompt["ref_usage"]
        transcription_jobs_repository.update_transcription_job(
            job_id,
            status="queued",
            resolved_prompt=refreshed_prompt["resolved_prompt"],
        )
        refreshed_job = transcription_jobs_repository.fetch_transcription_job(job_id)
        if refreshed_job is not None:
            job_payload = row_to_dict(refreshed_job)
            job_payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
                int(job_id)
            )
            job_payload["gemini_ref_usage"] = ref_usage
            if not ref_usage:
                message = "Job queued."
            elif all(item.get("ref_source") == "stored" for item in ref_usage):
                message = "Job queued using stored refs."
            else:
                ref_parts: list[str] = []
                for item in ref_usage:
                    sample_id = str(item.get("sample_id", ""))
                    ref_source = item.get("ref_source")
                    ref_reason = str(item.get("ref_reason") or "")
                    if ref_source == "stored":
                        ref_parts.append(f"{sample_id}: stored")
                    elif ref_reason:
                        ref_parts.append(f"{sample_id}: new ({ref_reason})")
                    else:
                        ref_parts.append(f"{sample_id}: new")
                message = "Job queued with ref refresh: " + ", ".join(ref_parts) + "."
            if job_event_hub is not None:
                job_event_hub.broadcast_threadsafe(
                    JobEventPayload.build(
                        event="job.queued",
                        message=message,
                        job_payload=job_payload,
                    )
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
            job_event_hub.broadcast_threadsafe(
                JobEventPayload.build(
                    event="job.pending",
                    message="Job moved back to pending.",
                    job_payload=_job_payload(
                        job_row=refreshed_job,
                        transcription_job_samples_repository=TranscriptionJobSamplesRepository(engine),
                    ),
                )
            )

    return {
        "workflow_id": workflow_id,
        "job_count": len(selected_job_ids),
        "updated_job_ids": selected_job_ids,
        "status": "pending",
    }
