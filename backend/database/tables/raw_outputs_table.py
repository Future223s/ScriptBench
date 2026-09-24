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
    UniqueConstraint,
    func,
)

from ..schema import PARSE_STATUS_CHECK_SQL, metadata


raw_outputs = Table(
    "raw_outputs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "execution_job_id",
        Integer,
        ForeignKey("execution_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "workflow_step_id",
        Integer,
        ForeignKey("workflow_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("attempt_no", Integer, nullable=False),
    Column("assembled_model_payload", JSON, nullable=False),
    Column("raw_model_response", Text, nullable=False),
    Column("parsed_output", JSON, nullable=True),
    Column("raw_individual_outputs", JSON, nullable=True),
    Column("complete_output", JSON, nullable=True),
    Column("parse_status", String(32), nullable=False, index=True),
    Column("parse_error", Text, nullable=True),
    Column("time_elapsed", Float, nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("completed_at", DateTime(timezone=True), nullable=False),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("execution_job_id", "attempt_no", name="uq_raw_outputs_job_attempt"),
    CheckConstraint(PARSE_STATUS_CHECK_SQL, name="ck_raw_outputs_parse_status"),
)
