from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

from ..schema import metadata

sample_uploads = Table(
    "sample_uploads",
    metadata,
    Column("upload_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.sample_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("model_family", String(64), nullable=False),
    Column("upload_ref", Text, nullable=False),
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
    UniqueConstraint("model_family", "sample_id", name="uq_sample_uploads_model_family_sample_id"),
)
