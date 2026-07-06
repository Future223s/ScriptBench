from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


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


class WorkflowScoreResponse(BaseModel):
    workflow_id: int
    run_results: ScoringRunResults
    workflow_metrics: WorkflowMetricRecord | None = None
