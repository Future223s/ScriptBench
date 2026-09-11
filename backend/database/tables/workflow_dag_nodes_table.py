from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Table, func

from ..schema import metadata

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
)
