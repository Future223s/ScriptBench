from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, func

from ..schema import PAYLOAD_BINDING_MODE_CHECK_SQL, PAYLOAD_SOURCE_TYPE_CHECK_SQL, metadata

payload_inputs = Table(
    "payload_inputs",
    metadata,
    Column("payload_input_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "payload_template_id",
        Integer,
        ForeignKey("payload_template.payload_template_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("binding_mode", String(32), nullable=False, index=True),
    Column("source_type", String(32), nullable=False, index=True),
    Column("source_object_id", Text, nullable=True, index=True),
    Column(
        "artifact_group_id",
        Integer,
        ForeignKey("artifact_groups.artifact_group_id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    ),
    Column("required", Boolean, nullable=False, server_default="1"),
    Column("template_path", JSON, nullable=False),
    Column("ordering_rule", JSON, nullable=True),
    Column("batch_limit", Integer, nullable=True),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
    CheckConstraint(PAYLOAD_BINDING_MODE_CHECK_SQL, name="ck_payload_inputs_binding_mode"),
    CheckConstraint(PAYLOAD_SOURCE_TYPE_CHECK_SQL, name="ck_payload_inputs_source_type"),
    CheckConstraint(
        "(binding_mode != 'fixed') OR (source_object_id IS NOT NULL)",
        name="ck_payload_inputs_fixed_source_object_id",
    ),
    CheckConstraint(
        "(binding_mode != 'sample-bound') OR (artifact_group_id IS NOT NULL)",
        name="ck_payload_inputs_sample_bound_artifact_group_id",
    ),
    CheckConstraint(
        "(binding_mode != 'fixed') OR (artifact_group_id IS NULL)",
        name="ck_payload_inputs_fixed_artifact_group_id_null",
    ),
    CheckConstraint(
        "(binding_mode != 'sample-bound') OR (source_object_id IS NULL)",
        name="ck_payload_inputs_sample_bound_source_object_id_null",
    ),
)
