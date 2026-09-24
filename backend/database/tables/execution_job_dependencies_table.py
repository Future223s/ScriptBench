from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, Table

from ..schema import metadata


execution_job_dependencies = Table(
    "execution_job_dependencies",
    metadata,
    Column("execution_job_id", Integer, ForeignKey("execution_jobs.id", ondelete="CASCADE"), primary_key=True),
    Column("depends_on_execution_job_id", Integer, ForeignKey("execution_jobs.id", ondelete="CASCADE"), primary_key=True),
)
