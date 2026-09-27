from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Table, UniqueConstraint, func

from ..schema import metadata


workflow_run_nodes = Table(
    "workflow_run_nodes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("workflow_run_id", Integer, ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("workflow_dag_node_id", Integer, ForeignKey("workflow_dag_nodes.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("topological_depth", Integer, nullable=False),
    Column("released", Boolean, nullable=False, server_default="1"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()),
    UniqueConstraint("workflow_run_id", "workflow_dag_node_id", name="uq_workflow_run_nodes_run_node"),
)
