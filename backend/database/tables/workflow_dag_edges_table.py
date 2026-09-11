from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Table, func

from ..schema import metadata

workflow_dag_edges = Table(
    "workflow_dag_edges",
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
        "from_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "to_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("condition", JSON, nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
)
