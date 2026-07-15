from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_serializer


def _format_sample_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class SampleRecord(BaseModel): 
    sample_id: str
    sample_name: str
    sample_blob: bytes | None = None
    sample_mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime


class SampleSummaryResponse(BaseModel):
    sample_id: str
    sample_name: str
    sample_mime_type: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_sample_timestamp(value)


class SampleResponse(BaseModel):
    sample_id: str
    sample_name: str
    sample_mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime
    has_sample_blob: bool = False
    sample_blob_size: int = 0
    sample_blob_base64: str | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_sample_timestamp(value)

class SampleCreateRequest(BaseModel):
    sample_id: str
    sample_name: str
    ground_truth_text: str | None = None


class SampleBlobUploadResponse(BaseModel):
    sample_id: str


class SampleDeleteRequest(BaseModel):
    sample_ids: list[str] = Field(default_factory=list)
