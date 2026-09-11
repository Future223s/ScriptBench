from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    func,
)

from ..schema import PROMPT_RESOURCE_TABLE_CHECK_SQL, metadata

prompt_resources = Table(
    "prompt_resources",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "payload_template_id",
        Integer,
        ForeignKey("payload_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("name", String(128), nullable=False),
    Column("source_table", String(64), nullable=False),
    Column("batch_limit", Integer, nullable=False, server_default="1"),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint(
        "payload_template_id", "name", name="uq_prompt_resources_template_name"
    ),
    CheckConstraint(
        PROMPT_RESOURCE_TABLE_CHECK_SQL, name="ck_prompt_resources_source_table"
    ),
    CheckConstraint("batch_limit > 0", name="ck_prompt_resources_batch_limit"),
)
