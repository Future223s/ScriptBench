from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

from ..schema import EXECUTION_JOB_STATUS_CHECK_SQL, metadata


execution_jobs = Table(
    "execution_jobs",
    metadata,
    Column("execution_job_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
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
        "current_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.workflow_dag_node_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("status", String(32), nullable=False, server_default="pending", index=True),
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
    CheckConstraint(EXECUTION_JOB_STATUS_CHECK_SQL, name="ck_execution_jobs_status"),
    UniqueConstraint(
        "workflow_id", "sample_id", name="uq_execution_jobs_workflow_sample"
    ),
)
