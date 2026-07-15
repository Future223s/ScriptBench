from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, JSON, String, Table, Text, UniqueConstraint, func

from ..schema import OUTPUT_SPEC_TYPE_CHECK_SQL, STATUS_CHECK_SQL, metadata

output_specs = Table(
    "output_specs",
    metadata,
    Column("output_spec_id", Integer, primary_key=True, autoincrement=True),
    Column("output_spec_name", String(255), nullable=False, unique=True, index=True),
    Column("type", String(32), nullable=False, index=True),
    Column("item_schema", JSON, nullable=True),
    Column("instructions", Text, nullable=True),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("output_spec_name", name="uq_output_specs_output_spec_name"),
    CheckConstraint(OUTPUT_SPEC_TYPE_CHECK_SQL, name="ck_output_specs_type"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_output_specs_status"),
)
