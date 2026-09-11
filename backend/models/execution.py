from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse
from .step_outputs import StepOutputRecord
from .workflow_steps import WorkflowStepRecord

ExecutionJobStatus = Literal["pending", "queued", "running", "completed", "failed"]


class ExecutionJobRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    workflow_id: int
    sample_id: str
    status: ExecutionJobStatus
    error_message: str | None = None
    current_workflow_dag_node_id: int
    next_step_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ExecutionControlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[int] = Field(default_factory=list)


class FailureAcknowledgementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["retry", "stop_execution"]


class ExecutionControlResponse(ApiResponse[dict[str, object]]):
    pass


class ExecutionJobDetail(ExecutionJobRecord):
    step_outputs: list[StepOutputRecord] = Field(default_factory=list)
    workflow_steps: list[WorkflowStepRecord] = Field(default_factory=list)
