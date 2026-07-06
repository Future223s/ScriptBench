from __future__ import annotations

from sqlalchemy import Float
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, UniqueConstraint, func

from ..schema import metadata

transcriptions = Table(
    "transcriptions",
    metadata,
    Column("transcription_id", Integer, primary_key=True, autoincrement=True),
    Column(
        "workflow_id",
        Integer,
        ForeignKey("workflows.workflow_id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "sample_id",
        String(255),
        nullable=True,
    ),
    Column("sample_ids", JSON, nullable=True),
    Column(
        "sample_set_id",
        Integer,
        ForeignKey("sample_sets.sample_set_id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column(
        "job_id",
        Integer,
        ForeignKey("transcription_jobs.job_id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("group_name", String(255), nullable=True),
    Column("group_value", String(255), nullable=True),
    Column("output_index", Integer, nullable=True),
    Column("transcription_text", Text, nullable=False),
    Column("metrics", JSON, nullable=True),
    Column("cer", Float, nullable=True),
    Column("wer", Float, nullable=True),
    Column("hallucinations", Float, nullable=True),
    Column("line_omission_count", Float, nullable=True),
    Column("line_addition_count", Float, nullable=True),
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
    UniqueConstraint("workflow_id", "sample_id", name="uq_transcriptions_workflow_sample"),
    UniqueConstraint(
        "workflow_id",
        "job_id",
        "output_index",
        name="uq_transcriptions_workflow_job_output",
    ),
)
