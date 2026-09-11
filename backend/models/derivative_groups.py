from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _format_derivative_group_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class DerivativeGroupRecord(BaseModel):
    id: int
    name: str
    description: str | None = None
    position_rule: dict[str, object] | None = None
    mapping_type: str
    status: str
    created_at: datetime
    model_config = ConfigDict(extra="forbid")


class DerivativeGroupCreateRequest(BaseModel):
    name: str
    description: str | None = None
    position_rule: dict[str, object] | None = None
    mapping_type: str = "one-to-one"
    derivative_ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class DerivativeGroupDeleteRequest(BaseModel):
    ids: list[int]

    model_config = ConfigDict(extra="forbid")


class DerivativeGroupResponse(DerivativeGroupRecord):
    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _format_derivative_group_timestamp(value)


class DerivativeGroupSummaryResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    mapping_type: str
    status: str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _format_derivative_group_timestamp(value)
