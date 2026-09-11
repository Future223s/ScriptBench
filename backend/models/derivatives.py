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


class DerivativeMapItem(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(extra="forbid")


class DerivativeMapRequest(BaseModel):
    derivatives: list[DerivativeMapItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativeMapResult(BaseModel):
    id: int | None = None
    name: str
    sample_id: str | None = None
    derivative_group_id: int | None = None
    category: str | None = None
    mime_type: str | None = None
    blob_base64: str | None = None
    blob_size: int | None = None
    mapping_type: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return _format_derivative_timestamp(value)


class DerivativeMapResponse(BaseModel):
    mapped_derivatives: list[DerivativeMapResult] = Field(default_factory=list)
    rejected_derivatives: list[dict[str, object]] = Field(default_factory=list)
    mapped_count: int = 0
    rejected_count: int = 0

    model_config = ConfigDict(extra="forbid")


class DerivativeMapApiResponse(ApiResponse[DerivativeMapResponse]):
    pass


class DerivativePatchItem(BaseModel):
    id: int
    sample_id: str | None = None
    derivative_group_id: int | None = None
    category: str | None = None
    mime_type: str | None = None

    model_config = ConfigDict(extra="forbid")


class DerivativePatchRequest(BaseModel):
    derivatives: list[DerivativePatchItem] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativePatchResponse(ApiResponse[list[DerivativeResponse]]):
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
