from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, Text, func

from ..schema import WORKFLOW_STATUS_CHECK_SQL, metadata

workflows = Table(
    "workflows",
    metadata,
    Column("workflow_id", Integer, primary_key=True, autoincrement=True),
    Column("workflow_name", String(255), nullable=False, index=True),
    Column(
        "sample_set_id",
        Integer,
        ForeignKey("sample_sets.sample_set_id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("workflow_description", Text, nullable=True),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
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
    CheckConstraint(WORKFLOW_STATUS_CHECK_SQL, name="ck_workflows_status"),
)
