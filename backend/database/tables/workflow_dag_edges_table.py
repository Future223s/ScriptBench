from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Table, func

from ..schema import metadata

workflow_dag_edges = Table(
    "workflow_dag_edges",
    metadata,
    Column("workflow_dag_edge_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "from_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.workflow_dag_node_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "to_workflow_dag_node_id",
        Integer,
        ForeignKey("workflow_dag_nodes.workflow_dag_node_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("edge_condition", JSON, nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
)
