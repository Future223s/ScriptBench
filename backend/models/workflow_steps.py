from __future__ import annotations

from datetime import datetime

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse


Scope = Literal[
    "documents_batch",
    "documents",
    "samples_batch",
    "samples",
    "derivatives_batch",
    "derivatives",
]


class WorkflowStepRecord(BaseModel):
    id: int
    name: str
    step_executor_id: str
    method: str
    executor_config: dict[str, Any]
    execution_scope: Scope = "samples"
    output_scope: Scope = "samples"
    payload_template_id: int | None = None
    output_spec_id: int | None = None
    created_at: datetime
    status: str

    model_config = ConfigDict(extra="forbid")


class WorkflowStepCreateRequest(BaseModel):
    name: str
    step_executor_id: str
    method: str
    executor_config: dict[str, Any]
    execution_scope: Scope = "samples"
    output_scope: Scope = "samples"
    payload_template_id: int = Field(gt=0)
    output_spec_id: int = Field(gt=0)
    model_config = ConfigDict(extra="forbid")


class WorkflowStepCreateResponse(ApiResponse[WorkflowStepRecord]):
    pass
