from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path as FastAPIPath
from backend.api.dependencies import get_engine
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.workflows import (
    WorkflowCreateRequest,
    WorkflowCreateResponse,
    WorkflowFinalizeResponse,
    WorkflowRecord,
    WorkflowUpdateRequest,
    WorkflowUpdateResponse,
)
from backend.database.repositories.workflow_dag_repository import WorkflowDagRepository
from backend.database.repositories.execution_jobs_repository import (
    ExecutionJobsRepository,
)
from backend.database.repositories.sample_set_samples_repository import (
    SampleSetSamplesRepository,
)

router = APIRouter(tags=["workflows-v2"])
logger = logging.getLogger(__name__)


@router.get("/api/v2/workflows", response_model=ApiListResponse[WorkflowRecord])
def list_workflows(engine=Depends(get_engine)) -> ApiListResponse[WorkflowRecord]:
    rows = WorkflowsRepository(engine).list()
    sample_sets_repository = SampleSetsRepository(engine)
    items = []
    for row in rows:
        sample_set = (
            sample_sets_repository.fetch(int(row["sample_set_id"]))
            if row["sample_set_id"] is not None
            else None
        )
        items.append(
            WorkflowRecord.model_validate(
                {
                    **row,
                    "sample_set_name": (
                        sample_set["sample_set_name"] if sample_set else None
                    ),
                }
            )
        )
    return ApiListResponse[WorkflowRecord](
        message="Workflows retrieved successfully.", items=items, count=len(items)
    )


@router.post("/api/v2/workflows", response_model=WorkflowCreateResponse)
def create_workflow(
    payload: WorkflowCreateRequest, engine=Depends(get_engine)
) -> WorkflowCreateResponse:
    workflow_name = payload.workflow_name.strip()
    if not workflow_name:
        raise HTTPException(status_code=400, detail="workflow_name is required")
    if payload.status != "draft":
        raise HTTPException(
            status_code=400, detail="New workflows must start in draft status"
        )
    if SampleSetsRepository(engine).fetch(payload.sample_set_id) is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    repository = WorkflowsRepository(engine)
    if any(
        str(row["workflow_name"]).casefold() == workflow_name.casefold()
        for row in repository.list()
    ):
        raise HTTPException(
            status_code=409, detail=f"Workflow already exists: {workflow_name}"
        )

    workflow_id = repository.insert(
        {
            "workflow_name": workflow_name,
            "workflow_description": (
                payload.workflow_description.strip()
                if payload.workflow_description
                else None
            ),
            "sample_set_id": payload.sample_set_id,
            "status": "draft",
        }
    )
    row = repository.fetch(workflow_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow after create"
        )
    return WorkflowCreateResponse(
        message="Workflow created successfully.",
        data=WorkflowRecord.model_validate(row),
    )


@router.get(
    "/api/v2/workflows/{workflow_id}", response_model=ApiResponse[WorkflowRecord]
)
def get_workflow(
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[WorkflowRecord]:
    row = WorkflowsRepository(engine).fetch(workflow_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return ApiResponse(
        message="Workflow retrieved successfully.",
        data=WorkflowRecord.model_validate(row),
    )


@router.patch("/api/v2/workflows/{workflow_id}", response_model=WorkflowUpdateResponse)
def update_workflow(
    payload: WorkflowUpdateRequest,
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> WorkflowUpdateResponse:
    repository = WorkflowsRepository(engine)
    workflow = repository.fetch(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow["status"] != "draft":
        raise HTTPException(status_code=409, detail="Finalized workflows are immutable")

    changes: dict[str, object] = {}
    if payload.workflow_name is not None:
        workflow_name = payload.workflow_name.strip()
        if not workflow_name:
            raise HTTPException(status_code=400, detail="workflow_name cannot be empty")
        if any(
            int(row["workflow_id"]) != workflow_id
            and str(row["workflow_name"]).casefold() == workflow_name.casefold()
            for row in repository.list()
        ):
            raise HTTPException(
                status_code=409, detail=f"Workflow already exists: {workflow_name}"
            )
        changes["workflow_name"] = workflow_name
    if payload.workflow_description is not None:
        changes["workflow_description"] = payload.workflow_description.strip() or None
    if payload.sample_set_id is not None:
        if SampleSetsRepository(engine).fetch(payload.sample_set_id) is None:
            raise HTTPException(status_code=404, detail="Sample set not found")
        changes["sample_set_id"] = payload.sample_set_id

    if changes:
        repository.update(workflow_id, changes)
    row = repository.fetch(workflow_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow after update"
        )
    return WorkflowUpdateResponse(
        message="Workflow saved successfully.", data=WorkflowRecord.model_validate(row)
    )


@router.patch(
    "/api/v2/workflows/{workflow_id}/finalize", response_model=WorkflowFinalizeResponse
)
def finalize_workflow(
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> WorkflowFinalizeResponse:
    repository = WorkflowsRepository(engine)
    workflow = repository.fetch(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow["status"] == "finalized":
        return WorkflowFinalizeResponse(
            message="Workflow is already finalized.",
            data=WorkflowRecord.model_validate(workflow),
        )
    if workflow["status"] != "draft":
        raise HTTPException(
            status_code=409,
            detail="Workflow cannot be finalized from its current status",
        )
    if workflow["sample_set_id"] is None:
        raise HTTPException(
            status_code=409,
            detail="A sample set is required before finalizing a workflow",
        )
    if not WorkflowDagRepository(engine).list_nodes(workflow_id):
        raise HTTPException(
            status_code=409,
            detail="At least one workflow DAG node is required before finalizing",
        )
    memberships = SampleSetSamplesRepository(engine).list_for_sample_set(
        int(workflow["sample_set_id"])
    )
    if not memberships:
        raise HTTPException(
            status_code=409,
            detail="The workflow sample set must contain at least one sample",
        )

    repository.update(workflow_id, {"status": "finalized"})
    ExecutionJobsRepository(engine).create_jobs(
        workflow_id=workflow_id,
        sample_ids=[str(membership["sample_id"]) for membership in memberships],
    )
    row = repository.fetch(workflow_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow after finalization"
        )
    return WorkflowFinalizeResponse(
        message="Workflow finalized successfully.",
        data=WorkflowRecord.model_validate(row),
    )
