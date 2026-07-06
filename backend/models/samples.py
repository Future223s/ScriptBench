from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SampleRecord(BaseModel):
    sample_id: str
    sample_group: str | None = None
    sample_groups: dict[str, Any] = Field(default_factory=dict)
    sample_mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime
    has_sample_blob: bool = False
    sample_blob_size: int = 0


class SampleDetailResponse(SampleRecord):
    sample_blob_base64: str | None = None


class SampleListResponse(BaseModel):
    samples: list[SampleRecord]
    sample_count: int


class SampleCreateResponse(SampleRecord):
    pass


class SampleDeleteResponse(BaseModel):
    sample_id: str
    deleted: bool
