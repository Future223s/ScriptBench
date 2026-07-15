from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Table, func

from ..schema import metadata

sample_set_samples = Table(
    "sample_set_samples",
    metadata,
    Column(
        "sample_set_id",
        Integer,
        ForeignKey("sample_sets.sample_set_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "sample_id",
        String(255),
        ForeignKey("samples.sample_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("position", Integer, nullable=False),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
    ),
)

Index("ix_sample_set_samples_sample_set_id_position", sample_set_samples.c.sample_set_id, sample_set_samples.c.position)
Index("ix_sample_set_samples_sample_id", sample_set_samples.c.sample_id)
