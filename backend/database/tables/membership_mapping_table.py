from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table, UniqueConstraint, func

from ..schema import MAPPING_OPERATOR_CHECK_SQL, metadata

membership_mapping = Table(
    "membership_mapping",
    metadata,
    Column("membership_mapping_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "artifact_group_id",
        Integer,
        ForeignKey("artifact_groups.artifact_group_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    ),
    Column("artifact_field", String(64), nullable=False, server_default="artifact_name", index=True),
    Column("operator", String(32), nullable=False, index=True),
    Column("pattern", String(255), nullable=False),
    Column("case_sensitive", Boolean, nullable=False, server_default="0"),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    UniqueConstraint("artifact_group_id", name="uq_membership_mapping_artifact_group_id"),
    CheckConstraint(MAPPING_OPERATOR_CHECK_SQL, name="ck_membership_mapping_operator"),
    CheckConstraint("pattern <> ''", name="ck_membership_mapping_pattern_not_empty"),
)
