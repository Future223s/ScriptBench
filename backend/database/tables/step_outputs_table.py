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
    UniqueConstraint,
    func,
)

from ..schema import OUTPUT_ENTITY_TYPE_CHECK_SQL, OUTPUT_SCOPE_CHECK_SQL, metadata

step_outputs = Table(
    "step_outputs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "raw_output_id",
        Integer,
        ForeignKey("raw_outputs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    ),
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
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ),
    Column("output_scope", String(32), nullable=False),
    Column("entity_type", String(32), nullable=False),
    Column("entity_key", String(255), nullable=False, index=True),
    Column("output", JSON, nullable=True),
    Column("cer", Float, nullable=True),
    Column("wer", Float, nullable=True),
    Column("hallucination_count", Integer, nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint(
        "execution_job_id", "workflow_step_id", "entity_type", "entity_key",
        name="uq_step_outputs_job_entity",
    ),
    CheckConstraint(OUTPUT_SCOPE_CHECK_SQL, name="ck_step_outputs_output_scope"),
    CheckConstraint(OUTPUT_ENTITY_TYPE_CHECK_SQL, name="ck_step_outputs_entity_type"),
)
