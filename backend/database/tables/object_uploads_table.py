from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, Table, Text, UniqueConstraint, func

from ..schema import OBJECT_UPLOAD_TYPE_CHECK_SQL, metadata

object_uploads = Table(
    "object_uploads",
    metadata,
    Column("upload_id", Integer, primary_key=True, autoincrement=True),
    Column("object_type", String(32), nullable=False),
    Column("object_id", Text, nullable=False),
    Column("model_family", String(64), nullable=False),
    Column("upload_ref", Text, nullable=False, index=True),
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
    ),
    UniqueConstraint(
        "object_type",
        "object_id",
        "model_family",
        name="uq_object_uploads_object_type_object_id_model_family",
    ),
    CheckConstraint(OBJECT_UPLOAD_TYPE_CHECK_SQL, name="ck_object_uploads_object_type"),
)
