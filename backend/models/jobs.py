from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class JobTransitionRequest(BaseModel):
    job_ids: list[int] | None = None

    model_config = ConfigDict(extra="forbid")


class TranscriptionJobUpdateRequest(BaseModel):
    status: str | None = None
    raw_content: str | None = None
    failure_reason: str | None = None
    time_elapsed: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    resolved_prompt: dict[str, Any] | list[Any] | str | None = None

    model_config = ConfigDict(extra="forbid")


class TranscriptionJobRecord(BaseModel):
    job_id: int
    workflow_id: int
    resolved_prompt: dict[str, Any] | list[Any] | str
    status: str
    raw_content: str | None = None
    failure_reason: str | None = None
    time_elapsed: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    sample_ids: list[str] = Field(default_factory=list)
    group_name: str | None = None
    group_value: str | None = None


class TranscriptionJobResponse(TranscriptionJobRecord):
    pass


class TranscriptionJobDeleteResponse(BaseModel):
    job_id: int
    deleted: bool = True
