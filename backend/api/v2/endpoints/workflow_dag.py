from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Path as FastAPIPath

from backend.api.dependencies import get_engine
from backend.database.repositories.workflow_dag_repository import WorkflowDagRepository
from backend.database.repositories.workflow_steps_repository import (
    WorkflowStepsRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.workflow_dag_edges import (
    WorkflowDagEdgeCreateRequest,
    WorkflowDagEdgeDeleteRequest,
    WorkflowDagEdgeCreateResponse,
    WorkflowDagEdgeRecord,
)
from backend.models.workflow_dag_nodes import (
    WorkflowDagNodeCreateRequest,
    WorkflowDagNodeCreateResponse,
    WorkflowDagNodeDeleteRequest,
    WorkflowDagNodeRecord,
)

router = APIRouter(tags=["workflow-dag-v2"])
logger = logging.getLogger(__name__)


def _workflow_or_404(engine, workflow_id: int):
    workflow = WorkflowsRepository(engine).fetch(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


def _editable(workflow: dict[str, object]) -> None:
    if workflow.get("status") != "draft":
        raise HTTPException(status_code=409, detail="Finalized workflows are immutable")


def _node_record(row: dict[str, object]) -> WorkflowDagNodeRecord:
    return WorkflowDagNodeRecord.model_validate(row)


def _edge_record(row: dict[str, object]) -> WorkflowDagEdgeRecord:
    return WorkflowDagEdgeRecord.model_validate(row)


def _would_create_cycle(
    edges: list[dict[str, object]], source_id: int, target_id: int
) -> bool:
    adjacency: dict[int, set[int]] = {}
    for edge in edges:
        adjacency.setdefault(int(edge["from_workflow_dag_node_id"]), set()).add(
            int(edge["to_workflow_dag_node_id"])
        )
    adjacency.setdefault(source_id, set()).add(target_id)
    pending = [target_id]
    visited: set[int] = set()
    while pending:
        current = pending.pop()
        if current == source_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        pending.extend(adjacency.get(current, set()))
    return False


@router.get(
    "/api/v2/workflows/{workflow_id}/workflow-dag-nodes",
    response_model=ApiListResponse[WorkflowDagNodeRecord],
)
def list_workflow_dag_nodes(
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiListResponse[WorkflowDagNodeRecord]:
    _workflow_or_404(engine, workflow_id)
    rows = WorkflowDagRepository(engine).list_nodes(workflow_id)
    items = [_node_record(row) for row in rows]
    return ApiListResponse(
        message="Workflow DAG nodes retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.post(
    "/api/v2/workflows/{workflow_id}/workflow-dag-nodes",
    response_model=WorkflowDagNodeCreateResponse,
)
def create_workflow_dag_node(
    payload: WorkflowDagNodeCreateRequest,
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> WorkflowDagNodeCreateResponse:
    workflow = _workflow_or_404(engine, workflow_id)
    _editable(workflow)
    steps = WorkflowStepsRepository(engine)
    if steps.fetch(payload.workflow_step_id) is None:
        raise HTTPException(status_code=404, detail="Workflow step not found")

    repository = WorkflowDagRepository(engine)
    existing = repository.list_nodes(workflow_id)
    if any(
        int(row["row"]) == payload.row and int(row["col"]) == payload.col
        for row in existing
    ):
        raise HTTPException(
            status_code=409, detail="Canvas position is already occupied"
        )

    node_id = repository.insert_node(
        {
            "workflow_id": workflow_id,
            "workflow_step_id": payload.workflow_step_id,
            "row": payload.row,
            "col": payload.col,
        }
    )
    row = repository.fetch_node(node_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow DAG node after create"
        )
    return WorkflowDagNodeCreateResponse(
        message="Workflow DAG node created successfully.", data=_node_record(row)
    )


@router.delete(
    "/api/v2/workflows/{workflow_id}/workflow-dag-nodes",
    response_model=ApiDeleteResponse,
)
def delete_workflow_dag_nodes(
    payload: WorkflowDagNodeDeleteRequest,
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    workflow = _workflow_or_404(engine, workflow_id)
    _editable(workflow)
    repository = WorkflowDagRepository(engine)
    node_ids = list(dict.fromkeys(payload.ids))
    existing_ids = {
        int(row["id"]) for row in repository.list_nodes(workflow_id)
    }
    missing = [node_id for node_id in node_ids if node_id not in existing_ids]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown workflow DAG node(s): {', '.join(map(str, missing))}",
        )
    deleted = repository.delete_nodes(workflow_id, node_ids)
    if deleted != len(node_ids):
        raise HTTPException(
            status_code=409, detail="Failed to delete workflow DAG nodes"
        )
    return ApiDeleteResponse(message="Workflow DAG nodes deleted successfully.")


@router.get(
    "/api/v2/workflows/{workflow_id}/workflow-dag-edges",
    response_model=ApiListResponse[WorkflowDagEdgeRecord],
)
def list_workflow_dag_edges(
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiListResponse[WorkflowDagEdgeRecord]:
    _workflow_or_404(engine, workflow_id)
    rows = WorkflowDagRepository(engine).list_edges(workflow_id)
    items = [_edge_record(row) for row in rows]
    return ApiListResponse(
        message="Workflow DAG edges retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.post(
    "/api/v2/workflows/{workflow_id}/workflow-dag-edges",
    response_model=WorkflowDagEdgeCreateResponse,
)
def create_workflow_dag_edge(
    payload: WorkflowDagEdgeCreateRequest,
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> WorkflowDagEdgeCreateResponse:
    workflow = _workflow_or_404(engine, workflow_id)
    _editable(workflow)
    if payload.from_workflow_dag_node_id == payload.to_workflow_dag_node_id:
        raise HTTPException(
            status_code=400, detail="A workflow DAG edge cannot target the same node"
        )

    repository = WorkflowDagRepository(engine)
    node_ids = {
        int(row["id"]) for row in repository.list_nodes(workflow_id)
    }
    if (
        payload.from_workflow_dag_node_id not in node_ids
        or payload.to_workflow_dag_node_id not in node_ids
    ):
        raise HTTPException(
            status_code=404,
            detail="Both workflow DAG nodes must belong to the workflow",
        )

    edges = repository.list_edges(workflow_id)
    duplicate = any(
        int(edge["from_workflow_dag_node_id"]) == payload.from_workflow_dag_node_id
        and int(edge["to_workflow_dag_node_id"]) == payload.to_workflow_dag_node_id
        for edge in edges
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Workflow DAG edge already exists")
    if _would_create_cycle(
        edges, payload.from_workflow_dag_node_id, payload.to_workflow_dag_node_id
    ):
        raise HTTPException(
            status_code=409, detail="Workflow DAG edges cannot create a cycle"
        )

    edge_id = repository.insert_edge(
        {
            "workflow_id": workflow_id,
            "from_workflow_dag_node_id": payload.from_workflow_dag_node_id,
            "to_workflow_dag_node_id": payload.to_workflow_dag_node_id,
            "condition": payload.condition,
        }
    )
    row = repository.fetch_edge(edge_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load workflow DAG edge after create"
        )
    return WorkflowDagEdgeCreateResponse(
        message="Workflow DAG edge created successfully.", data=_edge_record(row)
    )


@router.delete(
    "/api/v2/workflows/{workflow_id}/workflow-dag-edges/{edge_id}",
    response_model=ApiDeleteResponse,
)
def delete_workflow_dag_edge_by_path(
    workflow_id: int = FastAPIPath(..., ge=1),
    edge_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    return _delete_edge(workflow_id, edge_id, engine)


@router.delete(
    "/api/v2/workflows/{workflow_id}/workflow-dag-edges",
    response_model=ApiDeleteResponse,
)
def delete_workflow_dag_edge(
    payload: WorkflowDagEdgeDeleteRequest,
    workflow_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    return _delete_edge(workflow_id, payload.id, engine)


def _delete_edge(workflow_id: int, edge_id: int, engine) -> ApiDeleteResponse:
    workflow = _workflow_or_404(engine, workflow_id)
    _editable(workflow)
    row = WorkflowDagRepository(engine).fetch_edge(edge_id)
    if row is None or int(row["workflow_id"]) != workflow_id:
        raise HTTPException(status_code=404, detail="Workflow DAG edge not found")
    deleted = WorkflowDagRepository(engine).delete_edge(workflow_id, edge_id)
    if deleted != 1:
        raise HTTPException(
            status_code=409, detail="Failed to delete workflow DAG edge"
        )
    return ApiDeleteResponse(message="Workflow DAG edge deleted successfully.")
