from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .api import ApiResponse


class PromptResourceCreateRequest(BaseModel):
    name: str
    type: Literal["content", "binding"]
    source_table: Literal["assets", "documents", "derivatives", "samples", "step_outputs"]
    row_id: str | None = None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_target(self):
        if self.type == "content" and not str(self.row_id or "").strip():
            raise ValueError("Content prompt resources require row_id")
        if self.type == "binding" and self.row_id is not None:
            raise ValueError("Binding prompt resources cannot define row_id")
        return self


class PromptResourceRecord(PromptResourceCreateRequest):
    id: int
    payload_template_id: int
    created_at: datetime


class PayloadTemplateRecord(BaseModel):
    id: int
    name: str
    model_family: str
    payload: dict[str, Any]
    status: str
    created_at: datetime
    resources: list[PromptResourceRecord] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class PayloadTemplateCreateRequest(BaseModel):
    name: str
    model_family: str
    payload: dict[str, Any]
    resources: list[PromptResourceCreateRequest] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class PayloadTemplateDeleteRequest(BaseModel):
    ids: list[int]
    model_config = ConfigDict(extra="forbid")


class PayloadTemplateCreateResponse(ApiResponse[PayloadTemplateRecord]):
    pass
