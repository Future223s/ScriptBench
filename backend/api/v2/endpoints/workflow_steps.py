from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_engine
from backend.database.repositories.workflow_steps_repository import (
    WorkflowStepsRepository,
)
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.workflow_steps import WorkflowStepCreateRequest, WorkflowStepRecord

router = APIRouter(tags=["workflow-steps-v2"])
logger = logging.getLogger(__name__)


@router.get(
    "/api/v2/workflow-steps", response_model=ApiListResponse[WorkflowStepRecord]
)
def list_workflow_steps(
    engine=Depends(get_engine),
) -> ApiListResponse[WorkflowStepRecord]:
    items = [
        WorkflowStepRecord.model_validate(row)
        for row in WorkflowStepsRepository(engine).list()
    ]
    return ApiListResponse(
        message="Workflow steps retrieved successfully.", items=items, count=len(items)
    )


@router.post("/api/v2/workflow-steps", response_model=ApiResponse[WorkflowStepRecord])
def create_workflow_step(
    payload: WorkflowStepCreateRequest, engine=Depends(get_engine)
) -> ApiResponse[WorkflowStepRecord]:
    step_name = payload.step_name.strip()
    if not step_name:
        raise HTTPException(status_code=400, detail="step_name is required")
    repository = WorkflowStepsRepository(engine)
    workflow_step_id = repository.insert(
        {
            "step_name": step_name,
            "model_family": payload.model_family,
            "model": payload.model,
            "payload_template_id": payload.payload_template_id,
            "output_spec_id": payload.output_spec_id,
            "status": "draft",
        }
    )
    row = repository.fetch(workflow_step_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow step after create"
        )
    record = WorkflowStepRecord.model_validate(row)
    logger.info(
        "Created workflow step (workflow_step_id=%s, payload_template_id=%s, output_spec_id=%s)",
        workflow_step_id,
        payload.payload_template_id,
        payload.output_spec_id,
    )
    return ApiResponse[WorkflowStepRecord](
        message="Workflow step created successfully.", data=record
    )


@router.delete("/api/v2/workflow-steps/{workflow_step_id}")
def delete_workflow_step(
    workflow_step_id: int, engine=Depends(get_engine)
) -> dict[str, object]:
    deleted = WorkflowStepsRepository(engine).delete(workflow_step_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    return {"success": True, "deleted": True}
