from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, LargeBinary, String, Table, func

from ..schema import metadata

assets = Table(
    "assets",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(255), nullable=False, unique=True, index=True),
    Column("type", String(255), nullable=False, index=True),
    Column("blob", LargeBinary, nullable=True),
    Column("mime_type", String(255), nullable=True),
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
