from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkflowDagNodeRecord(BaseModel):
    workflow_dag_node_id: int
    workflow_id: int
    workflow_step_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
