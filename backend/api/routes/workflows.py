from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, ConfigDict, Field

from backend.api.dependencies import get_engine, row_to_dict
from backend.api.routes.prompt_spec import PromptSpec
from backend.database.repositories.samples_repository import SamplesRepository
from backend.database.repositories.workflow_samples_repository import (
    WorkflowSamplesRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository

router = APIRouter(tags=["workflows"])


class WorkflowCreateRequest(BaseModel):
    workflow_name: str
    workflow_stage: str
    model_family: str
    model: str | None = None
    workflow_groups: list[str] = Field(default_factory=list, alias="groups")
    prompt_spec: PromptSpec
    sample_ids: list[str] = Field(default_factory=list)
    status: str = "draft"

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


@router.post("/api/workflows")
def create_workflow(
    payload: WorkflowCreateRequest,
    engine=Depends(get_engine),
) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    workflow_samples_repository = WorkflowSamplesRepository(engine)
    samples_repository = SamplesRepository(engine)

    sample_ids = list(dict.fromkeys(payload.sample_ids))

    if sample_ids:
        missing_sample_ids = [
            sample_id
            for sample_id in sample_ids
            if samples_repository.fetch_sample(sample_id) is None
        ]
        if missing_sample_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
            )

    workflow_id = workflows_repository.insert_workflow(
        workflow_name=payload.workflow_name,
        workflow_stage=payload.workflow_stage,
        model_family=payload.model_family,
        model=payload.model,
        groups=payload.workflow_groups,
        status=payload.status,
        prompt_spec=payload.prompt_spec.model_dump(),
    )

    if sample_ids:
        workflow_samples_repository.replace_workflow_samples(
            workflow_id=workflow_id,
            workflow_stage=payload.workflow_stage,
            sample_ids=sample_ids,
        )

    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise HTTPException(status_code=500, detail="Failed to load workflow after create")

    workflow_payload = row_to_dict(workflow_row)
    workflow_payload["sample_ids"] = sample_ids
    workflow_payload["workflow_groups"] = workflow_payload.get("groups", [])
    return workflow_payload


@router.delete("/api/workflows/{workflow_id}")
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
