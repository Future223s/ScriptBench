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

from ..schema import ARTIFACT_CATEGORY_CHECK_SQL, metadata

artifacts = Table(
    "artifacts",
    metadata,
    Column("artifact_id", Integer, primary_key=True, autoincrement=True),
    Column("artifact_name", String(255), nullable=False, index=True),
    Column(
        "originating_sample_id",
        String(255),
        ForeignKey("samples.sample_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ),
    Column(
        "artifact_group_id",
        Integer,
        ForeignKey("artifact_groups.artifact_group_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    ),
    Column("artifact_group_name", String(255), nullable=True),
    Column("artifact_category", String(64), nullable=False, server_default="companion", index=True),
    Column("artifact_blob", LargeBinary, nullable=False),
    Column("artifact_mime_type", String(255), nullable=False),
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
        "originating_sample_id",
        "artifact_name",
        name="uq_artifacts_originating_sample_id_artifact_name",
    ),
    CheckConstraint(ARTIFACT_CATEGORY_CHECK_SQL, name="ck_artifacts_artifact_category"),
)
