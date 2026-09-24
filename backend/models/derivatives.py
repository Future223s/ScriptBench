from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_serializer

from .api import ApiDeleteResponse, ApiListResponse, ApiResponse


def _format_derivative_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class DerivativeRecord(BaseModel):
    id: int
    name: str
    sample_id: str | None = None
    derivative_group_id: int | None = None
    category: str
    mime_type: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")


class DerivativeResponse(DerivativeRecord):
    has_blob: bool = False
    blob_size: int = 0
    blob_base64: str | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return _format_derivative_timestamp(value)


class DerivativeSummaryResponse(BaseModel):
    id: int
    name: str
    sample_id: str | None = None
    derivative_group_id: int | None = None
    category: str
    mime_type: str
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("updated_at")
    def serialize_updated_at(self, value: datetime) -> str:
        return _format_derivative_timestamp(value)


class DerivativeCreateItem(BaseModel):
    name: str
    mime_type: str

    model_config = ConfigDict(extra="forbid")


class DerivativeCreateRequest(BaseModel):
    derivatives: list[DerivativeCreateItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativeCreateResponse(ApiResponse[list[DerivativeResponse]]):
    pass


class DerivativeUploadBlobItem(BaseModel):
    id: int
    blob_base64: str
    mime_type: str | None = None

    model_config = ConfigDict(extra="forbid")


class DerivativeUploadBlobRequest(BaseModel):
    derivatives: list[DerivativeUploadBlobItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativeDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativeUploadBlobResponse(ApiResponse[list[DerivativeResponse]]):
    pass


class DerivativeListResponse(ApiListResponse[DerivativeSummaryResponse]):
    pass


class DerivativeDeleteResponse(ApiDeleteResponse):
    pass
