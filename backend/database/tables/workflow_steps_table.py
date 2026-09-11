from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
    UniqueConstraint,
    func,
)

from ..schema import STATUS_CHECK_SQL, metadata
from .step_executors_table import step_executors  # noqa: F401

workflow_steps = Table(
    "workflow_steps",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(255), nullable=False, unique=True, index=True),
    Column("step_executor_id", String(64), ForeignKey("step_executors.id", ondelete="RESTRICT"), nullable=False, index=True),
    Column("method", String(64), nullable=False),
    Column("executor_config", JSON, nullable=False),
    Column(
        "payload_template_id",
        Integer,
        ForeignKey("payload_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column(
        "output_spec_id",
        Integer,
        ForeignKey("output_specs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("name", name="uq_workflow_steps_name"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_workflow_steps_status"),
)
