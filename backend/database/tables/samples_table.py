from __future__ import annotations

from sqlalchemy import Column, DateTime, LargeBinary, String, Table, Text, func

from ..schema import metadata

samples = Table(
    "samples",
    metadata,
    Column("sample_id", String(255), primary_key=True),
    Column("sample_name", String(255), nullable=False, unique=True, index=True),
    Column("sample_blob", LargeBinary, nullable=True),
    Column("sample_mime_type", String(255), nullable=True),
    Column("ground_truth_text", Text, nullable=True),
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
