from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    func,
    UniqueConstraint,
)

from ..schema import metadata

workflow_metrics = Table(
    "workflow_metrics",
    metadata,
    Column("workflow_metric_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("scorer", String(64), nullable=True),
    Column("sample_count", Integer, nullable=True),
    Column("cer", Float, nullable=True),
    Column("wer", Float, nullable=True),
    Column("hallucinations", Float, nullable=True),
    Column("line_omission_count", Float, nullable=True),
    Column("line_addition_count", Float, nullable=True),
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
        onupdate=func.current_timestamp(),
    ),
    UniqueConstraint("workflow_id", name="uq_workflow_metrics_workflow_id"),
)
