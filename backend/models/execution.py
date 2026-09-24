from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse
from .step_outputs import StepOutputRecord
from .raw_outputs import RawOutputRecord
from .workflow_steps import WorkflowStepRecord

ExecutionJobStatus = Literal["blocked", "pending", "queued", "running", "completed"]


class ExecutionJobRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    workflow_id: int
    sample_id: str | None = None
    workflow_run_id: int | None = None
    workflow_run_node_id: int | None = None
    workflow_step_id: int | None = None
    execution_scope: str = "samples"
    output_scope: str = "samples"
    input_key: str | None = None
    input_refs: list[dict[str, str]] = Field(default_factory=list)
    output_refs: list[dict[str, str]] = Field(default_factory=list)
    entity_ids: list[str] = Field(default_factory=list)
    output_entity_ids: list[str] = Field(default_factory=list)
    target_label: str
    status: ExecutionJobStatus
    error_message: str | None = None
    skip_reason: str | None = None
    current_workflow_dag_node_id: int | None = None
    workflow_dag_node_id: int | None = None
    topological_depth: int | None = None
    next_step_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ExecutionControlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[int] = Field(default_factory=list)


class FailureAcknowledgementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["retry", "skip", "abort"]


class ResolvedExecutionNode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workflow_run_node_id: int
    workflow_dag_node_id: int
    workflow_step_id: int
    step_name: str
    execution_scope: str
    output_scope: str
    topological_depth: int
    row: int
    col: int
    released: bool
    blocked: int
    pending: int
    queued: int
    running: int
    completed: int
    total: int


class ResolvedExecutionEdge(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: int
    workflow_id: int
    from_workflow_dag_node_id: int
    to_workflow_dag_node_id: int


class ResolvedExecutionGraph(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run: dict[str, object] | None
    nodes: list[ResolvedExecutionNode]
    edges: list[ResolvedExecutionEdge]


class ExecutionControlResponse(ApiResponse[dict[str, object]]):
    pass


class StepOutputDependency(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workflow_step_id: int
    source_workflow_step_id: int


class ExecutionJobDetail(ExecutionJobRecord):
    step_outputs: list[StepOutputRecord] = Field(default_factory=list)
    raw_outputs: list[RawOutputRecord] = Field(default_factory=list)
    workflow_steps: list[WorkflowStepRecord] = Field(default_factory=list)
    step_output_dependencies: list[StepOutputDependency] = Field(default_factory=list)
