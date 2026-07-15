from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, UniqueConstraint, func

from ..schema import STATUS_CHECK_SQL, metadata

workflow_steps = Table(
    "workflow_steps",
    metadata,
    Column("workflow_step_id", Integer, primary_key=True, autoincrement=True),
    Column("step_name", String(255), nullable=False, unique=True, index=True),
    Column("model_family", String(64), nullable=False, index=True),
    Column("model", String(255), nullable=False),
    Column(
        "payload_template_id",
        Integer,
        ForeignKey("payload_template.payload_template_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column(
        "output_spec_id",
        Integer,
        ForeignKey("output_specs.output_spec_id", ondelete="SET NULL"),
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
    UniqueConstraint("step_name", name="uq_workflow_steps_step_name"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_workflow_steps_status"),
)
