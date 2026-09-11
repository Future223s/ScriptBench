from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .api import ApiResponse


class PromptResourceConditionCreateRequest(BaseModel):
    field_name: str
    operator: Literal["equals", "not_equals", "greater_than", "less_than", "contains"]
    value_type: Literal["manual", "sample-field"]
    value: str
    model_config = ConfigDict(extra="forbid")


class PromptResourceConditionRecord(PromptResourceConditionCreateRequest):
    id: int
    prompt_resource_id: int
    position: int


class PromptResourceCreateRequest(BaseModel):
    name: str
    source_table: Literal["derivatives", "samples", "step_outputs"]
    batch_limit: int = Field(default=1, gt=0)
    conditions: list[PromptResourceConditionCreateRequest] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class PromptResourceRecord(PromptResourceCreateRequest):
    id: int
    payload_template_id: int
    created_at: datetime
    conditions: list[PromptResourceConditionRecord] = Field(default_factory=list)


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
