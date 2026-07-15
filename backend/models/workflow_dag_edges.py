from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkflowDagEdgeRecord(BaseModel):
    workflow_dag_edge_id: int
    workflow_id: int
    from_workflow_dag_node_id: int
    to_workflow_dag_node_id: int
    edge_condition: dict[str, object] | str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")
