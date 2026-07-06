from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, String, Table, Text, func

from ..schema import metadata

sample_sets = Table(
    "sample_sets",
    metadata,
    Column("sample_set_id", Integer, primary_key=True, autoincrement=True),
    Column("sample_set_name", String(255), nullable=False, index=True),
    Column("sample_set_description", Text, nullable=True),
    Column("sample_set_type", String(64), nullable=True),
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
)
