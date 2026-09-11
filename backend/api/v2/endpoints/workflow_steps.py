from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException

from backend.database.repositories.step_executors_repository import StepExecutorsRepository
from backend.services.executor_validation import validate_config
from sqlalchemy import select
from backend.database.tables.payload_templates_table import payload_templates

from backend.api.dependencies import get_engine
from backend.database.repositories.workflow_steps_repository import (
    WorkflowStepsRepository,
)
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.step_executors import StepExecutorSummary, StepExecutorRecord
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
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    definition = StepExecutorsRepository(engine).fetch(payload.step_executor_id)
    try:
        config = validate_config(definition, payload.executor_config, payload.method)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    with engine.connect() as connection:
        family = connection.execute(select(payload_templates.c.model_family).where(
            payload_templates.c.id == payload.payload_template_id
        )).scalar_one_or_none()
    if family != payload.step_executor_id:
        raise HTTPException(status_code=400, detail="Select a compatible payload template")
    repository = WorkflowStepsRepository(engine)
    workflow_step_id = repository.insert(
        {
            "name": name,
            "step_executor_id": payload.step_executor_id,
            "executor_config": config,
            "method": payload.method,
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
    repository = WorkflowStepsRepository(engine)
    if repository.fetch(workflow_step_id) is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")
    if repository.list_referencing_workflow_ids(workflow_step_id):
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete a workflow step until it has been removed from all workflows"
            ),
        )
    repository.delete(workflow_step_id)
    return {"success": True, "deleted": True}


@router.get("/api/v2/step-executors", response_model=ApiListResponse[StepExecutorSummary])
def list_step_executors(engine=Depends(get_engine)):
    items = StepExecutorsRepository(engine).list()
    return {"message": "Step executors retrieved", "items": [dict(item) for item in items], "count": len(items)}


@router.get("/api/v2/step-executors/{executor_id}", response_model=ApiResponse[StepExecutorRecord])
def get_step_executor(executor_id: str, engine=Depends(get_engine)):
    item = StepExecutorsRepository(engine).fetch(executor_id)
    if item is None or not item["active"]:
        raise HTTPException(status_code=404, detail="Step executor not found")
    return {"message": "Step executor retrieved", "data": dict(item)}
