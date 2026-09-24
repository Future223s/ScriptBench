from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RelationshipSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    direction: Literal["upstream", "downstream"]
    step_id: int
    step_name: str
    count: int


class TranscriptionMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attempt_no: int
    parse_status: str | None = None
    parse_error: str | None = None
    time_elapsed: float
    started_at: datetime
    completed_at: datetime


class TranscriptionAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    sample_id: str
    sample_name: str
    sample_set_id: int
    sample_set_name: str
    sample_mime_type: str | None = None
    workflow_id: int
    workflow_name: str
    workflow_step_id: int
    workflow_step_name: str
    text: str
    ground_truth: str | None = None
    cer: float | None = None
    disagreement_count: float | None = None
    relationships: list[RelationshipSummary] = Field(default_factory=list)
    assembled_model_payload: dict[str, Any] | None = None
    metadata: TranscriptionMetadata


class DisagreementAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    source_output_id: int
    target_output_id: int
    source_step_id: int
    source_step_name: str
    target_step_id: int
    target_step_name: str
    target_model: str | None = None
    sample_id: str
    sample_name: str
    sample_set_id: int
    sample_set_name: str
    workflow_id: int
    workflow_name: str
    ground_truth: str | None = None
    source_text: str
    target_text: str
    source_line_context: str
    target_line_context: str
    source_span_start: int
    source_span_end: int
    target_span_start: int
    target_span_end: int
    operation_type: Literal["insertion", "deletion", "substitution"]
    correctness_outcome: Literal[
        "correction", "regression", "neutral", "equivalent", "unresolved"
    ]


class SampleSetAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transcriptions: list[TranscriptionAnalysis] = Field(default_factory=list)
    disagreements: list[DisagreementAnalysis] = Field(default_factory=list)
    next_cursor: int | None = None
    has_more: bool = False


class TranscriptionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    output_id: int
    assembled_model_payload: dict[str, Any]


class FindDisagreementsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_set_id: int
    source_workflow_id: int
    target_workflow_id: int
    agreement_anchor_length: int = Field(default=4, ge=1, le=50)
    severity_threshold: float = Field(default=0.2, ge=0, le=1)
    minimum_raw_edits: int = Field(default=1, ge=1)


class ComputedDisagreementRegion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sequence: int
    source_start: int
    source_end: int
    target_start: int
    target_end: int
    source_text: str
    target_text: str
    raw_edit_count: int
    normalized_distance: float
    operation_type: Literal["insertion", "deletion", "substitution"]
    correctness_outcome: Literal[
        "correction", "regression", "neutral", "equivalent", "unresolved"
    ]


class WorkflowComparisonSample(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_id: str
    sample_name: str
    source_output_id: int
    target_output_id: int
    source_text: str
    target_text: str
    regions: list[ComputedDisagreementRegion] = Field(default_factory=list)


class SkippedComparisonSample(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_id: str
    sample_name: str
    reason: str


class WorkflowDisagreementComputation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_set_id: int
    source_workflow_id: int
    source_workflow_name: str
    target_workflow_id: int
    target_workflow_name: str
    target_model: str | None = None
    agreement_anchor_length: int
    severity_threshold: float
    minimum_raw_edits: int
    samples: list[WorkflowComparisonSample] = Field(default_factory=list)
    skipped_samples: list[SkippedComparisonSample] = Field(default_factory=list)
