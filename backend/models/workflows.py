from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic import Field
from .api import ApiResponse


class WorkflowRecord(BaseModel):
    id: int
    name: str
    sample_set_id: int
    description: str | None = None
    execution_mode: Literal["continuous", "stage_by_stage"] = "continuous"
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")


class WorkflowCreateRequest(BaseModel):
    name: str
    description: str | None = None
    sample_set_id: int = Field(gt=0)
    status: str = "draft"
    execution_mode: Literal["continuous", "stage_by_stage"] = "continuous"

    model_config = ConfigDict(extra="forbid")


class WorkflowCreateResponse(ApiResponse[WorkflowRecord]):
    pass


class WorkflowUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    sample_set_id: int | None = Field(default=None, gt=0)
    execution_mode: Literal["continuous", "stage_by_stage"] | None = None

    model_config = ConfigDict(extra="forbid")


class WorkflowUpdateResponse(ApiResponse[WorkflowRecord]):
    pass


class WorkflowFinalizeResponse(ApiResponse[WorkflowRecord]):
    pass
