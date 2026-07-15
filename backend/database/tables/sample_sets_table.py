from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, Table, Text, func

from ..schema import STATUS_CHECK_SQL, metadata

sample_sets = Table(
    "sample_sets",
    metadata,
    Column("sample_set_id", Integer, primary_key=True, autoincrement=True),
    Column("sample_set_name", String(255), nullable=False, index=True),
    Column("sample_set_description", Text, nullable=True),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_sample_sets_status"),
)
