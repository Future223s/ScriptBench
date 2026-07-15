from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Table, func

from ..schema import metadata

workflow_dag_nodes = Table(
    "workflow_dag_nodes",
    metadata,
    Column("workflow_dag_node_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
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
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
)
