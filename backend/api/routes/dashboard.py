from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.dependencies import cap_values, get_engine, row_to_dict
from backend.database.repositories.workflow_samples_repository import (
    WorkflowSamplesRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
def get_dashboard(engine=Depends(get_engine)) -> dict[str, object]:
    workflows_repository = WorkflowsRepository(engine)
    workflow_samples_repository = WorkflowSamplesRepository(engine)

    workflow_rows = workflows_repository.list_workflows()

    payload = []
    for workflow_row in workflow_rows:
        workflow_id = int(workflow_row["workflow_id"])
        sample_ids = workflow_samples_repository.fetch_workflow_samples(
            workflow_id=workflow_id,
            workflow_stage=str(workflow_row["workflow_stage"]),
        )
        workflow_payload = row_to_dict(workflow_row)
        workflow_payload["sample_ids"] = cap_values(sample_ids, limit=5)
        workflow_payload["sample_count"] = len(sample_ids)
        payload.append(workflow_payload)

    return {
        "workflows": payload,
        "workflow_count": len(payload),
    }
