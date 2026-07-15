from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _format_artifact_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class ArtifactRecord(BaseModel):
    artifact_id: int
    artifact_name: str
    originating_sample_id: str | None = None
    artifact_group_id: int | None = None
    artifact_group_name: str | None = None
    artifact_category: str
    artifact_mime_type: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")


class ArtifactResponse(ArtifactRecord):
    has_artifact_blob: bool = False
    artifact_blob_size: int = 0
    artifact_blob_base64: str | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_artifact_timestamp(value)


class ArtifactSummaryResponse(BaseModel):
    artifact_id: int
    artifact_name: str
    originating_sample_id: str | None = None
    artifact_group_id: int | None = None
    artifact_group_name: str | None = None
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("updated_at")
    def serialize_updated_at(self, value: datetime) -> str:
        return _format_artifact_timestamp(value)


class ArtifactCreateItem(BaseModel):
    artifact_name: str
    artifact_mime_type: str

    model_config = ConfigDict(extra="forbid")


class ArtifactCreateRequest(BaseModel):
    artifacts: list[ArtifactCreateItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ArtifactMapItem(BaseModel):
    artifact_id: int
    artifact_name: str

    model_config = ConfigDict(extra="forbid")


class ArtifactMapRequest(BaseModel):
    artifacts: list[ArtifactMapItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ArtifactMapResponse(BaseModel):
    mapped_artifacts: list[dict[str, Any]] = Field(default_factory=list)
    rejected_artifacts: list[dict[str, Any]] = Field(default_factory=list)
    mapped_count: int = 0
    rejected_count: int = 0

    model_config = ConfigDict(extra="forbid")

class ArtifactUploadBlobItem(BaseModel):
    artifact_id: int
    artifact_blob_base64: str
    artifact_mime_type: str | None = None

    model_config = ConfigDict(extra="forbid")


class ArtifactUploadBlobRequest(BaseModel):
    artifacts: list[ArtifactUploadBlobItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")

