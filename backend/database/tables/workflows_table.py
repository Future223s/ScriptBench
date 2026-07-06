from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Integer,
    JSON,
    String,
    Table,
    UniqueConstraint,
    func,
    ForeignKey,
)

from ..schema import MODEL_FAMILY_CHECK_SQL, metadata

workflows = Table(
    "workflows",
    metadata,
    Column("workflow_id", Integer, primary_key=True, autoincrement=True),
    Column("workflow_name", String(255), nullable=False, index=True),
    Column("workflow_stage", String(255), nullable=False),
    Column(
        "sample_set_id",
        Integer,
        ForeignKey("sample_sets.sample_set_id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("model_family", String(64), nullable=False),
    Column("model", String(255), nullable=True),
    Column("groups", JSON, nullable=False, default=list),
    Column("prompt_spec", JSON, nullable=False),
    Column(
        "status",
        String(64),
        nullable=False,
        server_default="draft",
    ),
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
    CheckConstraint(
        MODEL_FAMILY_CHECK_SQL,
        name="ck_workflows_model_family",
    ),
    UniqueConstraint("workflow_id", "workflow_stage", name="uq_workflows_id_stage"),
)
