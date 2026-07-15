from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, func

from ..schema import EXECUTION_ROW_STATUS_CHECK_SQL, EXECUTION_SCOPE_CHECK_SQL, metadata

execution_rows = Table(
    "execution_rows",
    metadata,
    Column("execution_row_id", Integer, primary_key=True, autoincrement=True),
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
    Column("status", String(32), nullable=False, server_default="not_started", index=True),
    Column("execution_scope", String(32), nullable=False, index=True),
    Column(
        "parent_execution_row_id",
        Integer,
        ForeignKey("execution_rows.execution_row_id", ondelete="CASCADE"),
        nullable=True,
    ),
    Column(
        "current_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.workflow_dag_node_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column("decomposed_item_position", Integer, nullable=True, index=True),
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
    CheckConstraint(EXECUTION_ROW_STATUS_CHECK_SQL, name="ck_execution_rows_status"),
    CheckConstraint(EXECUTION_SCOPE_CHECK_SQL, name="ck_execution_rows_execution_scope"),
    CheckConstraint(
        "(execution_scope != 'decomposed_item') OR (decomposed_item_position IS NOT NULL)",
        name="ck_execution_rows_decomposed_item_position",
    ),
)
