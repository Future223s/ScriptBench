from __future__ import annotations

from sqlalchemy import (
    Boolean,
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

from ..schema import MAPPING_OPERATOR_CHECK_SQL, metadata

sample_mapping = Table(
    "sample_mapping",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "derivative_group_id",
        Integer,
        ForeignKey("derivative_groups.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    ),
    Column(
        "derivative_field",
        String(64),
        nullable=False,
        server_default="name",
        index=True,
    ),
    Column(
        "sample_field",
        String(64),
        nullable=False,
        server_default="name",
        index=True,
    ),
    Column("operator", String(32), nullable=False, index=True),
    Column("case_sensitive", Boolean, nullable=False, server_default="0"),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("derivative_group_id", name="uq_sample_mapping_derivative_group_id"),
    CheckConstraint(MAPPING_OPERATOR_CHECK_SQL, name="ck_sample_mapping_operator"),
)
