from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GroupingCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    sample_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class GroupingValueRequest(BaseModel):
    value: str = Field(min_length=1)
    sample_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class GroupingRecord(BaseModel):
    name: str
    source: str
    assignments: dict[str, Any] = Field(default_factory=dict)


class GroupingListResponse(BaseModel):
    groupings: list[GroupingRecord]
    grouping_count: int


class GroupingDeleteResponse(BaseModel):
    group_name: str
    deleted: bool
    updated_samples: int
