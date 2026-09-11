from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _format_asset_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class AssetRecord(BaseModel):
    id: int
    name: str
    type: str
    blob: bytes | None = None
    mime_type: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetSummaryResponse(BaseModel):
    id: int
    name: str
    type: str
    mime_type: str | None = None
    created_at: datetime
    updated_at: datetime
    has_blob: bool = False
    blob_size: int = 0

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetResponse(BaseModel):
    id: int
    name: str
    type: str
    mime_type: str | None = None
    created_at: datetime
    updated_at: datetime
    has_blob: bool = False
    blob_size: int = 0
    blob_base64: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetCreateRequest(BaseModel):
    name: str
    type: str

    model_config = ConfigDict(extra="forbid")


class AssetBlobUploadResponse(BaseModel):
    id: int

    model_config = ConfigDict(extra="forbid")


class AssetDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")
