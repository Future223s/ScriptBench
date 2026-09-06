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
    Text,
    UniqueConstraint,
    func,
)

from ..schema import metadata


step_outputs = Table(
    "step_outputs",
    metadata,
    Column("step_output_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "execution_job_id",
        Integer,
        ForeignKey("execution_jobs.execution_job_id", ondelete="CASCADE"),
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
    Column(
        "workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.workflow_dag_node_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.sample_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "status", String(32), nullable=False, server_default="completed", index=True
    ),
    Column("output_value", JSON, nullable=True),
    Column("source_model_output_ids", JSON, nullable=False),
    Column("error_message", Text, nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint("status IN ('completed', 'failed')", name="ck_step_outputs_status"),
    UniqueConstraint(
        "execution_job_id", "workflow_step_id", name="uq_step_outputs_job_step"
    ),
)
