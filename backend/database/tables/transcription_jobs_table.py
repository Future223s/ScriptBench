from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
    Text,
    func,
)

from ..schema import TRANSCRIPTION_JOB_STATUS_CHECK_SQL, metadata

transcription_jobs = Table(
    "transcription_jobs",
    metadata,
    Column("job_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("resolved_prompt", JSON, nullable=False),
    Column(
        "status",
        String(64),
        nullable=False,
        server_default="pending",
    ),
    Column("raw_content", Text, nullable=True),
    Column("failure_reason", Text, nullable=True),
    Column("time_elapsed", Float, nullable=True),
    Column("started_at", DateTime(timezone=True), nullable=True),
    Column("completed_at", DateTime(timezone=True), nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint(
        TRANSCRIPTION_JOB_STATUS_CHECK_SQL,
        name="ck_transcription_jobs_status",
    ),
)
