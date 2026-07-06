from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from .prompt_spec import PromptSpec


class GroupingCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    sample_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class GroupingValueRequest(BaseModel):
    value: str = Field(min_length=1)
    sample_ids: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class SampleSetCreateRequest(BaseModel):
    sample_set_name: str = Field(alias="name", min_length=1)
    sample_ids: list[str] = Field(default_factory=list)
    sample_set_description: str | None = Field(default=None, alias="description")
    sample_set_type: str | None = Field(default=None, alias="type")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class WorkflowCreateRequestBase(BaseModel):
    workflow_name: str
    workflow_stage: str
    model_family: str
    model: str | None = None
    workflow_groups: list[str] = Field(default_factory=list, alias="groups")
    prompt_spec: PromptSpec
    status: str = "draft"

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class WorkflowCreateRequest(WorkflowCreateRequestBase):
    sample_ids: list[str] = Field(default_factory=list)


class V1WorkflowCreateRequest(WorkflowCreateRequestBase):
    sample_set_id: int = Field(
        validation_alias=AliasChoices("sample_set_id", "sampleSetId")
    )


class JobTransitionRequest(BaseModel):
    job_ids: list[int] | None = None

    model_config = ConfigDict(extra="forbid")


class TranscriptionJobUpdateRequest(BaseModel):
    status: str | None = None
    raw_content: str | None = None
    failure_reason: str | None = None
    time_elapsed: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    resolved_prompt: dict[str, Any] | list[Any] | str | None = None

    model_config = ConfigDict(extra="forbid")


class SampleRecord(BaseModel):
    sample_id: str
    sample_group: str | None = None
    sample_groups: dict[str, Any] = Field(default_factory=dict)
    sample_mime_type: str | None = None
    ground_truth_text: str | None = None
    created_at: datetime
    updated_at: datetime
    has_sample_blob: bool = False
    sample_blob_size: int = 0


class SampleDetailResponse(SampleRecord):
    sample_blob_base64: str | None = None


class SampleListResponse(BaseModel):
    samples: list[SampleRecord]
    sample_count: int


class SampleCreateResponse(SampleRecord):
    pass


class SampleDeleteResponse(BaseModel):
    sample_id: str
    deleted: bool


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


class WorkflowRecord(BaseModel):
    workflow_id: int
    workflow_name: str
    workflow_stage: str
    sample_set_id: int | None = None
    model_family: str
    model: str | None = None
    groups: list[str] = Field(default_factory=list)
    prompt_spec: dict[str, Any] = Field(default_factory=dict)
    status: str
    created_at: datetime
    updated_at: datetime
    sample_ids: list[str] = Field(default_factory=list)
    sample_count: int | None = None
    workflow_groups: list[str] = Field(default_factory=list)


class WorkflowListResponse(BaseModel):
    workflows: list[WorkflowRecord]
    workflow_count: int


class WorkflowDeleteResponse(BaseModel):
    workflow_id: int
    deleted: bool


class WorkflowWorkspaceResponse(BaseModel):
    workflow: WorkflowRecord
    samples: list[SampleRecord]
    open_jobs: list["TranscriptionJobRecord"]
    pending_jobs: list["TranscriptionJobRecord"]
    queued_jobs: list["TranscriptionJobRecord"]
    completed_jobs: list["TranscriptionJobRecord"]
    transcriptions: list["TranscriptionRecord"]


class V1WorkflowWorkspaceResponse(BaseModel):
    workflow: WorkflowRecord
    sample_ids: list[str]
    pending_jobs: list["TranscriptionJobRecord"]
    queued_jobs: list["TranscriptionJobRecord"]
    completed_jobs: list["TranscriptionJobRecord"]
    transcriptions: list["TranscriptionRecord"]


class WorkspaceOpenedResponse(BaseModel):
    workflow_id: int
    workflow_stage: str
    updated_at: datetime


class WorkspaceJobsResponse(BaseModel):
    workflow_id: int
    workflow_stage: str
    workflow_groups: list[str]
    batch_size: int
    job_count: int
    jobs: list["TranscriptionJobRecord"]
    message: str | None = None


class WorkspaceJobsTransitionResponse(BaseModel):
    workflow_id: int
    job_count: int
    updated_job_ids: list[int]
    status: str


class WorkspaceJobsDeleteResponse(BaseModel):
    workflow_id: int
    kind: str
    transcriptions_deleted: int
    transcription_job_samples_deleted: int
    transcription_jobs_deleted: int


class WorkflowTranscriptionsBatchResponse(BaseModel):
    workflow_id: int
    transcription_count: int
    transcriptions: list["TranscriptionRecord"]


class TranscriptionRecord(BaseModel):
    transcription_id: int
    workflow_id: int
    sample_id: str | None = None
    sample_ids: list[str] = Field(default_factory=list)
    sample_set_id: int | None = None
    job_id: int | None = None
    group_name: str | None = None
    group_value: str | None = None
    output_index: int | None = None
    transcription_text: str
    metrics: dict[str, Any] | None = None
    cer: float | None = None
    wer: float | None = None
    hallucinations: float | None = None
    line_omission_count: float | None = None
    line_addition_count: float | None = None
    created_at: datetime
    updated_at: datetime


class TranscriptionDetailResponse(BaseModel):
    transcription: TranscriptionRecord
    ground_truth_text: str
    sample_ids: list[str]


class TranscriptionJobRecord(BaseModel):
    job_id: int
    workflow_id: int
    resolved_prompt: dict[str, Any] | list[Any] | str
    status: str
    raw_content: str | None = None
    failure_reason: str | None = None
    time_elapsed: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    sample_ids: list[str] = Field(default_factory=list)
    group_name: str | None = None
    group_value: str | None = None


class TranscriptionJobResponse(TranscriptionJobRecord):
    pass


class TranscriptionJobDeleteResponse(BaseModel):
    job_id: int
    deleted: bool = True


class WorkflowMetricRecord(BaseModel):
    workflow_metric_id: int
    workflow_id: int
    scorer: str | None = None
    sample_count: int | None = None
    cer: float | None = None
    wer: float | None = None
    hallucinations: float | None = None
    line_omission_count: float | None = None
    line_addition_count: float | None = None
    created_at: datetime
    updated_at: datetime


class ScoringSampleResult(BaseModel):
    sample_id: str
    model_family: str
    char_gt_total: int
    char_edits: int
    cer: float
    word_gt_total: int
    word_edits: int
    wer: float
    line_omission_count: int
    line_addition_count: int
    hallucination_count: int
    workflow_id: int
    workflow_name: str
    workflow_stage: str
    transcription_id: int
    transcription_text: str
    metrics: dict[str, Any] | None = None


class ScoringRunResults(BaseModel):
    model: str
    workflow_name: str
    stage: str
    workflow_id: int
    scorer: str
    per_sample: list[ScoringSampleResult]
    aggregates: dict[str, Any]
    job_samples_by_job_id: dict[str, list[str]]


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


class WorkflowScoreResponse(BaseModel):
    workflow_id: int
    run_results: ScoringRunResults
    workflow_metrics: WorkflowMetricRecord | None = None


class JobEventPayload(BaseModel):
    event: str
    type: str
    message: str
    workflow_id: int | None = None
    job_id: int | None = None
    status: str | None = None
    job: TranscriptionJobRecord | dict[str, Any]


WorkflowWorkspaceResponse.model_rebuild()
V1WorkflowWorkspaceResponse.model_rebuild()
WorkspaceJobsResponse.model_rebuild()
WorkflowTranscriptionsBatchResponse.model_rebuild()
TranscriptionDetailResponse.model_rebuild()
TranscriptionJobResponse.model_rebuild()
JobEventPayload.model_rebuild()
