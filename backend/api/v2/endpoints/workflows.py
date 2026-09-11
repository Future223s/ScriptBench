from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path as FastAPIPath
from backend.api.dependencies import get_engine
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.database.repositories.workflow_steps_repository import (
    WorkflowStepsRepository,
)
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
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
from backend.database.repositories.prompt_resources_repository import (
    PromptResourcesRepository,
)

router = APIRouter(tags=["workflows-v2"])
logger = logging.getLogger(__name__)


def validate_workflow_dag(engine, workflow_id: int) -> None:
    """Reject a non-DAG or prompt-output dependency that cannot be executed."""
    dag = WorkflowDagRepository(engine)
    nodes = dag.list_nodes(workflow_id)
    edges = dag.list_edges(workflow_id)
    node_ids = {int(node["id"]) for node in nodes}
    adjacency: dict[int, set[int]] = {node_id: set() for node_id in node_ids}

    for edge in edges:
        source_id = int(edge["from_workflow_dag_node_id"])
        target_id = int(edge["to_workflow_dag_node_id"])
        if source_id not in node_ids or target_id not in node_ids:
            raise HTTPException(
                status_code=409,
                detail="Workflow DAG edge references a node outside this workflow",
            )
        adjacency[source_id].add(target_id)

    visiting: set[int] = set()
    visited: set[int] = set()

    def visit(node_id: int) -> None:
        if node_id in visiting:
            raise HTTPException(
                status_code=409, detail="Workflow DAG contains a cycle"
            )
        if node_id in visited:
            return
        visiting.add(node_id)
        for next_node_id in adjacency[node_id]:
            visit(next_node_id)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in node_ids:
        visit(node_id)

    def is_upstream(source_id: int, target_id: int) -> bool:
        pending = list(adjacency[source_id])
        seen: set[int] = set()
        while pending:
            current_id = pending.pop()
            if current_id == target_id:
                return True
            if current_id in seen:
                continue
            seen.add(current_id)
            pending.extend(adjacency[current_id])
        return False

    nodes_by_step: dict[int, list[int]] = {}
    for node in nodes:
        nodes_by_step.setdefault(int(node["workflow_step_id"]), []).append(
            int(node["id"])
        )
    if any(len(node_ids) != 1 for node_ids in nodes_by_step.values()):
        raise HTTPException(
            status_code=409,
            detail="Each workflow step may appear only once in a workflow DAG",
        )

    steps = WorkflowStepsRepository(engine)
    resources = PromptResourcesRepository(engine)
    for node in nodes:
        node_id = int(node["id"])
        step = steps.fetch(int(node["workflow_step_id"]))
        if step is None or step.get("payload_template_id") is None:
            continue
        for resource in resources.list_for_template(int(step["payload_template_id"])):
            if resource["source_table"] != "step_outputs":
                continue
            step_conditions = [
                condition
                for condition in resource["conditions"]
                if condition["field_name"] == "workflow_step_id"
                and condition["operator"] == "equals"
                and condition["value_type"] == "manual"
            ]
            if len(step_conditions) != 1:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A step_outputs prompt resource must select exactly one "
                        "workflow step"
                    ),
                )
            try:
                dependency_step_id = int(step_conditions[0]["value"])
            except (TypeError, ValueError) as error:
                raise HTTPException(
                    status_code=409,
                    detail="The selected step_outputs workflow step is invalid",
                ) from error
            dependency_nodes = nodes_by_step.get(dependency_step_id, [])
            if len(dependency_nodes) != 1:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "The selected step_outputs workflow step must appear exactly "
                        "once in this workflow DAG"
                    ),
                )
            if not is_upstream(dependency_nodes[0], node_id):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "A step_outputs prompt resource must depend on an upstream "
                        "workflow step"
                    ),
                )


@router.get("/api/v2/workflows", response_model=ApiListResponse[WorkflowRecord])
def list_workflows(engine=Depends(get_engine)) -> ApiListResponse[WorkflowRecord]:
    rows = WorkflowsRepository(engine).list()
    items = [WorkflowRecord.model_validate(row) for row in rows]
    return ApiListResponse[WorkflowRecord](
        message="Workflows retrieved successfully.", items=items, count=len(items)
    )


@router.post("/api/v2/workflows", response_model=WorkflowCreateResponse)
def create_workflow(
    payload: WorkflowCreateRequest, engine=Depends(get_engine)
) -> WorkflowCreateResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if payload.status != "draft":
        raise HTTPException(
            status_code=400, detail="New workflows must start in draft status"
        )
    if SampleSetsRepository(engine).fetch(payload.sample_set_id) is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    repository = WorkflowsRepository(engine)
    if any(
        str(row["name"]).casefold() == name.casefold()
        for row in repository.list()
    ):
        raise HTTPException(
            status_code=409, detail=f"Workflow already exists: {name}"
        )

    workflow_id = repository.insert(
        {
            "name": name,
            "description": (
                payload.description.strip()
                if payload.description
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


@router.delete(
    "/api/v2/workflows/{workflow_id}", response_model=ApiDeleteResponse
)
def delete_workflow(
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    repository = WorkflowsRepository(engine)
    if repository.fetch(workflow_id) is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    deleted = repository.delete(workflow_id)
    if deleted != 1:
        raise HTTPException(
            status_code=409,
            detail=f"Failed to delete workflow: {workflow_id}",
        )

    return ApiDeleteResponse(message="Workflow deleted successfully.")


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
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")
        if any(
            int(row["id"]) != workflow_id
            and str(row["name"]).casefold() == name.casefold()
            for row in repository.list()
        ):
            raise HTTPException(
                status_code=409, detail=f"Workflow already exists: {name}"
            )
        changes["name"] = name
    if payload.description is not None:
        changes["description"] = payload.description.strip() or None
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

    validate_workflow_dag(engine, workflow_id)
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
