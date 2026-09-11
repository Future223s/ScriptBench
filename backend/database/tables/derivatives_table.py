from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

from ..schema import DERIVATIVE_CATEGORY_CHECK_SQL, metadata

derivatives = Table(
    "derivatives",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(255), nullable=False, index=True),
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ),
    Column(
        "derivative_group_id",
        Integer,
        ForeignKey("derivative_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column(
        "category",
        String(64),
        nullable=False,
        server_default="companion",
        index=True,
    ),
    Column("blob", LargeBinary, nullable=False),
    Column("mime_type", String(255), nullable=False),
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
    UniqueConstraint(
        "sample_id",
        "name",
        name="uq_derivatives_sample_id_name",
    ),
    CheckConstraint(DERIVATIVE_CATEGORY_CHECK_SQL, name="ck_derivatives_category"),
)
