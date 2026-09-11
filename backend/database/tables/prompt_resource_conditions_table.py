from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
)

from ..schema import (
    PROMPT_RESOURCE_OPERATOR_CHECK_SQL,
    PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL,
    metadata,
)

prompt_resource_conditions = Table(
    "prompt_resource_conditions",
    metadata,
    Column(
        "id", Integer, primary_key=True, autoincrement=True
    ),
    Column(
        "prompt_resource_id",
        Integer,
        ForeignKey("prompt_resources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("field_name", String(128), nullable=False),
    Column("operator", String(32), nullable=False),
    Column("value_type", String(32), nullable=False),
    Column("value", String(1024), nullable=False),
    Column("position", Integer, nullable=False),
    UniqueConstraint(
        "prompt_resource_id", "position", name="uq_prompt_resource_conditions_position"
    ),
    CheckConstraint(
        PROMPT_RESOURCE_OPERATOR_CHECK_SQL,
        name="ck_prompt_resource_conditions_operator",
    ),
    CheckConstraint(
        PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL,
        name="ck_prompt_resource_conditions_value_type",
    ),
    CheckConstraint("position >= 0", name="ck_prompt_resource_conditions_position"),
)
