from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, func

from ..schema import MAPPING_TYPE_CHECK_SQL, STATUS_CHECK_SQL, metadata

artifact_groups = Table(
    "artifact_groups",
    metadata,
    Column("artifact_group_id", Integer, primary_key=True, autoincrement=True),
    Column("artifact_group_name", String(255), nullable=False, index=True),
    Column(
        "membership_mapping_id",
        Integer,
        ForeignKey("membership_mapping.membership_mapping_id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    ),
    Column(
        "sample_mapping_id",
        Integer,
        ForeignKey("sample_mapping.sample_mapping_id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    ),
    Column("position_rule", JSON, nullable=True),
    Column("mapping_type", String(32), nullable=False, server_default="one-to-one", index=True),
    Column("artifact_group_description", Text, nullable=True),
    Column("status", String(32), nullable=False, server_default="draft", index=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint(MAPPING_TYPE_CHECK_SQL, name="ck_artifact_groups_mapping_type"),
    CheckConstraint(STATUS_CHECK_SQL, name="ck_artifact_groups_status"),
)
