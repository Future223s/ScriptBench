from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse

ExecutionJobStatus = Literal["pending", "queued", "running", "completed", "failed"]


class ExecutionJobRecord(BaseModel):
    execution_job_id: int
    workflow_id: int
    sample_id: str
    execution_scope: Literal["source", "decomposed_item"] = "source"
    status: ExecutionJobStatus
    error_message: str | None = None
    current_workflow_dag_node_id: int | None = None
    next_step_name: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(extra="forbid")


class ExecutionControlRequest(BaseModel):
    execution_job_ids: list[int] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class FailureAcknowledgementRequest(BaseModel):
    action: Literal["retry", "stop_execution"]


class ExecutionControlResponse(ApiResponse[dict[str, object]]):
    pass
