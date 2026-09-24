from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic import Field
from .api import ApiResponse


class WorkflowDagNodeRecord(BaseModel):
    id: int
    workflow_id: int
    workflow_step_id: int
    row: int
    col: int
    execution_scope: Literal[
        "documents_batch",
        "documents",
        "samples_batch",
        "samples",
        "derivatives_batch",
        "derivatives",
    ] = "samples"
    output_scope: Literal[
        "documents_batch",
        "documents",
        "samples_batch",
        "samples",
        "derivatives_batch",
        "derivatives",
    ] = "samples"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")


class WorkflowDagNodeCreateRequest(BaseModel):
    workflow_step_id: int = Field(gt=0)
    row: int = Field(ge=1)
    col: int = Field(ge=1)
    model_config = ConfigDict(extra="forbid")


class WorkflowDagNodeDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class WorkflowDagNodeCreateResponse(ApiResponse[WorkflowDagNodeRecord]):
    pass
