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

from ..schema import (
    PROMPT_RESOURCE_TABLE_CHECK_SQL,
    PROMPT_RESOURCE_TARGET_CHECK_SQL,
    PROMPT_RESOURCE_TYPE_CHECK_SQL,
    metadata,
)

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
    Column("type", String(32), nullable=False, server_default="binding"),
    Column("source_table", String(64), nullable=False),
    # Polymorphic stable key; exposed as row_id by the API. The canonical schema
    # reserves *_id columns for enforceable foreign keys.
    Column("row_key", String(255), nullable=True),
    # Retained as an inert legacy column so existing databases are upgraded
    # without discarding their previous prompt-resource configuration.
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
    CheckConstraint(
        PROMPT_RESOURCE_TYPE_CHECK_SQL, name="ck_prompt_resources_type"
    ),
    CheckConstraint(
        PROMPT_RESOURCE_TARGET_CHECK_SQL, name="ck_prompt_resources_target"
    ),
    CheckConstraint("batch_limit > 0", name="ck_prompt_resources_batch_limit"),
)
