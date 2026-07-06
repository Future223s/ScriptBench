from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .workflows import WorkflowRecord


class SampleSetCreateRequest(BaseModel):
    sample_set_name: str = Field(alias="name", min_length=1)
    sample_ids: list[str] = Field(default_factory=list)
    sample_set_description: str | None = Field(default=None, alias="description")
    sample_set_type: str | None = Field(default=None, alias="type")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class SampleSetRecord(BaseModel):
    sample_set_id: int
    sample_set_name: str
    sample_set_description: str | None = None
    sample_set_type: str | None = None
    created_at: datetime
    updated_at: datetime
    sample_ids: list[str] = Field(default_factory=list)
    sample_count: int = 0
    sample_ids_preview: list[str] = Field(default_factory=list)
    workflow_count: int = 0


class SampleSetListResponse(BaseModel):
    sample_sets: list[SampleSetRecord]
    sample_set_count: int


class SampleSetDeleteResponse(BaseModel):
    sample_set_id: int
    deleted: bool


class SampleSetMetricWorkflowResult(BaseModel):
    workflow: WorkflowRecord
    value: float


class SampleSetMetricSummary(BaseModel):
    best_workflow: SampleSetMetricWorkflowResult
    worst_workflow: SampleSetMetricWorkflowResult
    min: float
    max: float
    median: float
    mean: float
    std: float


class SampleSetAnalyticsResponse(BaseModel):
    sample_set: SampleSetRecord
    sample_ids: list[str]
    sample_count: int
    workflow_count: int
    workflows: list[WorkflowRecord]
    metrics: dict[str, SampleSetMetricSummary]


class SampleSetCreateResponse(SampleSetRecord):
    pass
