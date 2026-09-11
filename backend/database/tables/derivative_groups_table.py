from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Table,
    Text,
    func,
)

from ..schema import MAPPING_TYPE_CHECK_SQL, STATUS_CHECK_SQL, metadata

derivative_groups = Table(
    "derivative_groups",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(255), nullable=False, index=True),
    Column("position_rule", JSON, nullable=True),
    Column(
        "mapping_type",
        String(32),
        nullable=False,
        server_default="one-to-one",
        index=True,
    ),
    Column("description", Text, nullable=True),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint(MAPPING_TYPE_CHECK_SQL, name="ck_derivative_groups_mapping_type"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_derivative_groups_status"),
)
