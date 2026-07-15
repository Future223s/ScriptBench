from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ObjectUploadRecord(BaseModel):
    upload_id: int
    object_type: str
    object_id: str
    model_family: str
    upload_ref: str
    created_at: datetime
    updated_at: datetime


class ObjectUploadListResponse(BaseModel):
    uploads: list[ObjectUploadRecord]
    upload_count: int
