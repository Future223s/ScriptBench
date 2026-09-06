from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic import Field
from .api import ApiResponse


class WorkflowDagEdgeRecord(BaseModel):
    workflow_dag_edge_id: int
    workflow_id: int
    from_workflow_dag_node_id: int
    to_workflow_dag_node_id: int
    edge_condition: dict[str, object] | str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class WorkflowDagEdgeCreateRequest(BaseModel):
    from_workflow_dag_node_id: int = Field(gt=0)
    to_workflow_dag_node_id: int = Field(gt=0)
    edge_condition: dict[str, object] | str = Field(
        default_factory=lambda: {"type": "depends_on"}
    )

    model_config = ConfigDict(extra="forbid")


class WorkflowDagEdgeDeleteRequest(BaseModel):
    workflow_dag_edge_id: int = Field(gt=0)

    model_config = ConfigDict(extra="forbid")


class WorkflowDagEdgeCreateResponse(ApiResponse[WorkflowDagEdgeRecord]):
    pass
