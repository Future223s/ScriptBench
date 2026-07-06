from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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


class WorkflowTranscriptionsBatchResponse(BaseModel):
    workflow_id: int
    transcription_count: int
    transcriptions: list[TranscriptionRecord]
