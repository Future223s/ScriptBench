from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .api import ApiDeleteResponse, ApiListResponse, ApiResponse


class SampleSetRecord(BaseModel):
    sample_set_id: int
    sample_set_name: str
    sample_set_description: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class SampleSetSampleRecord(BaseModel):
    sample_set_id: int
    sample_id: str
    position: int
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class SampleSetResponse(SampleSetRecord):
    sample_ids: list[str] = Field(default_factory=list)


class SampleSetCreateRequest(BaseModel):
    sample_set_name: str
    sample_set_description: str | None = None
    sample_ids: list[str] = Field(default_factory=list)


class SampleSetListResponse(ApiListResponse[SampleSetResponse]):
    pass


class SampleSetGetResponse(ApiResponse[SampleSetResponse]):
    pass


class SampleSetCreateResponse(ApiResponse[SampleSetResponse]):
    pass


class SampleSetDeleteResponse(ApiDeleteResponse):
    pass
