from __future__ import annotations

from sqlalchemy import MetaData

MODEL_FAMILIES: tuple[str, ...] = (
    "gemini",
    "gpt",
    "claude",
    "mistral",
    "escriptorium",
)

WORKFLOW_STATUSES: tuple[str, ...] = (
    "draft",
    "queued",
    "running",
    "completed",
    "failed",
    "paused",
)

UPLOAD_STATUSES: tuple[str, ...] = (
    "active",
    "stale",
    "failed",
)

OUTPUT_STATUSES: tuple[str, ...] = (
    "pending",
    "success",
    "failed",
    "skipped",
)

TRANSCRIPTION_JOB_STATUSES: tuple[str, ...] = (
    "pending",
    "queued",
    "running",
    "completed",
    "failed",
)

MODEL_FAMILY_CHECK_SQL = (
    "model_family IN ('gemini', 'gpt', 'claude', 'mistral', 'escriptorium')"
)

TRANSCRIPTION_JOB_STATUS_CHECK_SQL = (
    "status IN ('pending', 'queued', 'running', 'completed', 'failed')"
)

metadata = MetaData()
