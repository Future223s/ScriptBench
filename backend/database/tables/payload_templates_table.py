from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, JSON, String, Table, UniqueConstraint, func

from ..schema import STATUS_CHECK_SQL, metadata

payload_template = Table(
    "payload_template",
    metadata,
    Column("payload_template_id", Integer, primary_key=True, autoincrement=True),
    Column("payload_template_name", String(255), nullable=False, unique=True, index=True),
    Column("payload_template", JSON, nullable=False),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("payload_template_name", name="uq_payload_template_name"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_payload_template_status"),
)

payload_templates = payload_template
