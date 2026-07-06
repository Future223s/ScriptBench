from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.api.dependencies import get_engine, row_to_dict
from backend.database.repositories.sample_set_samples_repository import SampleSetSamplesRepository
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.transcription_job_samples_repository import TranscriptionJobSamplesRepository
from backend.database.repositories.transcription_jobs_repository import TranscriptionJobsRepository
from backend.database.repositories.transcriptions_repository import TranscriptionsRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.workflows import V1WorkflowCreateRequest as WorkflowCreateRequest


router = APIRouter(tags=["workflows-v1"])

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
    job_rows = transcription_jobs_repository.fetch_transcription_jobs_for_workflow(workflow_id)
    transcription_rows = transcriptions_repository.fetch_transcriptions_for_workflow(workflow_id)

    pending_jobs: list[dict[str, object]] = []
    queued_jobs: list[dict[str, object]] = []
    completed_jobs: list[dict[str, object]] = []
    for job_row in job_rows:
        job_payload = row_to_dict(job_row)
        job_payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
            int(job_row["job_id"])
        )
        status = str(job_payload.get("status", "")).strip().lower()
        if status == "pending":
            pending_jobs.append(job_payload)
        elif status in {"queued", "running"}:
            queued_jobs.append(job_payload)
        else:
            completed_jobs.append(job_payload)

    return {
        "workflow": row_to_dict(workflow_row),
        "sample_ids": sample_ids,
        "pending_jobs": pending_jobs,
        "queued_jobs": queued_jobs,
        "completed_jobs": completed_jobs,
        "transcriptions": [row_to_dict(row) for row in transcription_rows],
    }

