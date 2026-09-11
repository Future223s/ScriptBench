from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _format_sample_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class SampleRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    blob: bytes | None = None
    mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime


class SampleSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_sample_timestamp(value)


class SampleResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime
    has_blob: bool = False
    blob_size: int = 0
    blob_base64: str | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_sample_timestamp(value)


class SampleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    ground_truth_text: str | None = None


class SampleBlobUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str


class SampleDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(default_factory=list)
