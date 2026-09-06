from __future__ import annotations

from datetime import datetime

from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse


class WorkflowStepRecord(BaseModel):
    workflow_step_id: int
    step_name: str
    model_family: str
    model: str | None = None
    payload_template_id: int | None = None
    output_spec_id: int | None = None
    created_at: datetime
    status: str

    model_config = ConfigDict(extra="forbid")


class WorkflowStepCreateRequest(BaseModel):
    step_name: str
    model_family: str
    model: str
    payload_template_id: int = Field(gt=0)
    output_spec_id: int = Field(gt=0)
    model_config = ConfigDict(extra="forbid")


class WorkflowStepCreateResponse(ApiResponse[WorkflowStepRecord]):
    pass
