from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Table, Text, UniqueConstraint, func

from ..schema import PARSE_STATUS_CHECK_SQL, metadata

model_outputs = Table(
    "model_outputs",
    metadata,
    Column("model_output_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "execution_row_id",
        Integer,
        ForeignKey("execution_rows.execution_row_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "workflow_step_id",
        Integer,
        ForeignKey("workflow_steps.workflow_step_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("attempt_no", Integer, nullable=False),
    Column("assembled_model_payload", JSON, nullable=False),
    Column("raw_model_response", Text, nullable=False),
    Column("parsed_output", JSON, nullable=True),
    Column("parse_status", String(32), nullable=True, index=True),
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
    UniqueConstraint("execution_row_id", "attempt_no", name="uq_model_outputs_execution_row_id_attempt_no"),
    CheckConstraint(
        "(parse_status IS NULL) OR (" + PARSE_STATUS_CHECK_SQL + ")",
        name="ck_model_outputs_parse_status",
    ),
)
