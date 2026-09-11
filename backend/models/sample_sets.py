from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .api import ApiDeleteResponse, ApiListResponse, ApiResponse


class SampleSetRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    name: str
    description: str | None = None
    status: str
    created_at: datetime



class SampleSetSampleRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_set_id: int
    sample_id: str
    position: int
    created_at: datetime



class SampleSetResponse(SampleSetRecord):
    sample_ids: list[str] = Field(default_factory=list)


class SampleSetCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    description: str | None = None
    sample_ids: list[str] = Field(default_factory=list)


class SampleSetListResponse(ApiListResponse[SampleSetResponse]):
    pass


class SampleSetGetResponse(ApiResponse[SampleSetResponse]):
    pass


class SampleSetCreateResponse(ApiResponse[SampleSetResponse]):
    pass


class SampleSetDeleteResponse(ApiDeleteResponse):
    pass
