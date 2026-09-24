from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, func

from ..schema import EXECUTION_SCOPE_CHECK_SQL, metadata

workflow_dag_nodes = Table(
    "workflow_dag_nodes",
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
        "workflow_step_id",
        Integer,
        ForeignKey("workflow_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("row", Integer, nullable=False, server_default="1"),
    Column("col", Integer, nullable=False, server_default="1"),
    Column("execution_scope", String(32), nullable=False, server_default="samples"),
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
    CheckConstraint(EXECUTION_SCOPE_CHECK_SQL, name="ck_workflow_dag_nodes_scope"),
)
