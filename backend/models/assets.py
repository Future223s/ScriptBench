from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _format_asset_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class AssetRecord(BaseModel):
    asset_id: int
    asset_name: str
    asset_type: str
    asset_blob: bytes | None = None
    asset_mime_type: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetSummaryResponse(BaseModel):
    asset_id: int
    asset_name: str
    asset_type: str
    asset_mime_type: str | None = None
    created_at: datetime
    updated_at: datetime
    has_asset_blob: bool = False
    asset_blob_size: int = 0

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetResponse(BaseModel):
    asset_id: int
    asset_name: str
    asset_type: str
    asset_mime_type: str | None = None
    created_at: datetime
    updated_at: datetime
    has_asset_blob: bool = False
    asset_blob_size: int = 0
    asset_blob_base64: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_asset_timestamp(value)


class AssetCreateRequest(BaseModel):
    asset_name: str
    asset_type: str

    model_config = ConfigDict(extra="forbid")


class AssetBlobUploadResponse(BaseModel):
    asset_id: int

    model_config = ConfigDict(extra="forbid")


class AssetDeleteRequest(BaseModel):
    asset_ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")
