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

from ..schema import (
    EXECUTION_JOB_STATUS_CHECK_SQL,
    EXECUTION_SCOPE_CHECK_SQL,
    OUTPUT_SCOPE_CHECK_SQL,
    metadata,
)


execution_jobs = Table(
    "execution_jobs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.id", ondelete="CASCADE"),
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
    Column("workflow_run_id", Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=True, index=True),
    Column("workflow_run_node_id", Integer, ForeignKey("workflow_run_nodes.id", ondelete="CASCADE"), nullable=True, index=True),
    Column("workflow_step_id", Integer, ForeignKey("workflow_steps.id", ondelete="CASCADE"), nullable=True, index=True),
    Column(
        "current_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("execution_scope", String(32), nullable=False, server_default="samples"),
    Column("output_scope", String(32), nullable=False, server_default="samples"),
    Column("input_key", String(1024), nullable=True),
    Column("input_refs", JSON, nullable=False, server_default="[]"),
    Column("output_refs", JSON, nullable=False, server_default="[]"),
    Column("status", String(32), nullable=False, server_default="pending", index=True),
    Column("error_message", Text, nullable=True),
    Column("skip_reason", Text, nullable=True),
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
    CheckConstraint(EXECUTION_SCOPE_CHECK_SQL, name="ck_execution_jobs_scope"),
    CheckConstraint(OUTPUT_SCOPE_CHECK_SQL, name="ck_execution_jobs_output_scope"),
    UniqueConstraint("workflow_run_node_id", "input_key", name="uq_execution_jobs_run_node_input"),
)
