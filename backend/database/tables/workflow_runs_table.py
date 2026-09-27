from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, func

from ..schema import (
    WORKFLOW_EXECUTION_MODE_CHECK_SQL,
    WORKFLOW_RUN_STATUS_CHECK_SQL,
    metadata,
)


workflow_runs = Table(
    "workflow_runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    ),
    Column("execution_mode", String(32), nullable=False, server_default="continuous"),
    Column("status", String(32), nullable=False, server_default="stopped", index=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()),
    CheckConstraint(WORKFLOW_EXECUTION_MODE_CHECK_SQL, name="ck_workflow_runs_execution_mode"),
    CheckConstraint(WORKFLOW_RUN_STATUS_CHECK_SQL, name="ck_workflow_runs_status"),
)
