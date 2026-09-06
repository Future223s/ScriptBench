from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Literal

from .api import ApiResponse


class PayloadTemplateRecord(BaseModel):
    payload_template_id: int
    payload_template_name: str
    model_family: str
    payload_template: dict[str, Any]
    status: str
    created_at: datetime
    resources: list[dict[str, Any]] = Field(default_factory=list)


class PromptResourceConditionCreateRequest(BaseModel):
    field: str
    operator: Literal["equals", "not_equals", "greater_than", "less_than", "contains"]
    value_type: Literal["manual", "sample-field"]
    value: str
    model_config = ConfigDict(extra="forbid")


class PromptResourceCreateRequest(BaseModel):
    name: str
    table: Literal["artifacts", "samples"]
    batch_limit: int = Field(default=1, gt=0)
    conditions: list[PromptResourceConditionCreateRequest] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class PayloadTemplateCreateRequest(BaseModel):
    payload_template_name: str
    description: str | None = None
    model_family: str
    payload_template: dict[str, Any]
    resources: list[PromptResourceCreateRequest] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class PayloadTemplateDeleteRequest(BaseModel):
    payload_template_ids: list[int]

    model_config = ConfigDict(extra="forbid")


class PayloadTemplateCreateResponse(ApiResponse[PayloadTemplateRecord]):
    pass

    model_config = ConfigDict(extra="forbid")
