from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Integer,
    JSON,
    String,
    Table,
    UniqueConstraint,
    func,
)

from ..schema import STATUS_CHECK_SQL, metadata

payload_templates = Table(
    "payload_templates",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "name", String(255), nullable=False, unique=True, index=True
    ),
    Column("model_family", String(64), nullable=False, index=True),
    Column("payload", JSON, nullable=False),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("name", name="uq_payload_templates_name"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_payload_templates_status"),
)
