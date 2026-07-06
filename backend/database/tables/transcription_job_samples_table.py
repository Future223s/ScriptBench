from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, func

from ..schema import metadata

transcription_job_samples = Table(
    "transcription_job_samples",
    metadata,
    Column(
        "job_id",
        Integer,
        ForeignKey("transcription_jobs.job_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.sample_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "position",
        Integer,
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
)
