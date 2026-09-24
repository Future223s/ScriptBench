from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DocumentSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    metadata: dict[str, Any] | None = None
    mime_type: str | None = None
    has_blob: bool = False
    blob_size: int = 0
    sample_count: int = 0
    created_at: datetime
    updated_at: datetime


class DocumentResponse(DocumentSummaryResponse):
    sample_ids: list[str] = Field(default_factory=list)
    sample_names: list[str] = Field(default_factory=list)
    blob_base64: str | None = None


class DocumentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    name: str
    metadata: dict[str, Any] | None = None


class DocumentBlobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str


class DocumentDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[str] = Field(default_factory=list)
