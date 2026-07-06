from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from .jobs import TranscriptionJobRecord
from .prompt_spec import PromptSpec
from .samples import SampleRecord
from .transcriptions import TranscriptionRecord


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
    open_jobs: list[TranscriptionJobRecord]
    pending_jobs: list[TranscriptionJobRecord]
    queued_jobs: list[TranscriptionJobRecord]
    completed_jobs: list[TranscriptionJobRecord]
    transcriptions: list[TranscriptionRecord]


class V1WorkflowWorkspaceResponse(BaseModel):
    workflow: WorkflowRecord
    sample_ids: list[str]
    pending_jobs: list[TranscriptionJobRecord]
    queued_jobs: list[TranscriptionJobRecord]
    completed_jobs: list[TranscriptionJobRecord]
    transcriptions: list[TranscriptionRecord]


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
    jobs: list[TranscriptionJobRecord]
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
