from __future__ import annotations

from datetime import datetime

from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse


class WorkflowStepRecord(BaseModel):
    id: int
    name: str
    step_executor_id: str
    method: str
    executor_config: dict[str, Any]
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
    payload_template_id: int = Field(gt=0)
    output_spec_id: int = Field(gt=0)
    model_config = ConfigDict(extra="forbid")


class WorkflowStepCreateResponse(ApiResponse[WorkflowStepRecord]):
    pass
