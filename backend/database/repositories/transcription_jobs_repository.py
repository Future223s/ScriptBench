from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.transcription_jobs_table import transcription_jobs


class TranscriptionJobsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert_transcription_job(
        self,
        *,
        workflow_id: int,
        resolved_prompt: Mapping[str, Any] | Sequence[Any] | str,
        status: str,
        raw_content: str | None = None,
        failure_reason: str | None = None,
        time_elapsed: float | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        created_at: datetime | None = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        created_at = created_at or now
        if started_at is None and status in {"running", "completed", "failed"}:
            started_at = created_at
        if completed_at is None and status in {"completed", "failed"}:
            completed_at = created_at

        insert_stmt = (
            postgresql_insert(transcription_jobs)
            if self.engine.dialect.name == "postgresql"
            else sqlite_insert(transcription_jobs)
        )
        stmt = insert_stmt.values(
            workflow_id=workflow_id,
            resolved_prompt=resolved_prompt,
            status=status,
            raw_content=raw_content,
            failure_reason=failure_reason,
            time_elapsed=time_elapsed,
            started_at=started_at,
            completed_at=completed_at,
            created_at=created_at,
        )
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
            return int(result.inserted_primary_key[0])

    def update_transcription_job(
        self,
        job_id: int,
        **fields: Any,
    ) -> None:
        if not fields:
            return

        update_fields = dict(fields)
        update_fields.pop("job_id", None)
        stmt = (
            transcription_jobs.update()
            .where(transcription_jobs.c.job_id == job_id)
            .values(**update_fields)
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def fetch_transcription_job(self, job_id: int) -> RowMapping | None:
        stmt = select(transcription_jobs).where(transcription_jobs.c.job_id == job_id)
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def fetch_transcription_jobs_for_workflow(self, workflow_id: int) -> list[RowMapping]:
        stmt = (
            select(transcription_jobs)
            .where(transcription_jobs.c.workflow_id == workflow_id)
            .order_by(transcription_jobs.c.job_id.asc())
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def fetch_queued_transcription_jobs(self, limit: int | None = None) -> list[RowMapping]:
        stmt = (
            select(transcription_jobs)
            .where(transcription_jobs.c.status == "queued")
            .order_by(transcription_jobs.c.job_id.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def fetch_open_transcription_jobs_for_workflow(
        self,
        workflow_id: int,
    ) -> list[RowMapping]:
        rows = self.fetch_transcription_jobs_for_workflow(workflow_id)
        return [
            row
            for row in rows
            if str(row["status"]) in {"pending", "queued", "running"}
        ]

    def fetch_completed_transcription_jobs_for_workflow(
        self,
        workflow_id: int,
    ) -> list[RowMapping]:
        rows = self.fetch_transcription_jobs_for_workflow(workflow_id)
        return [
            row
            for row in rows
            if str(row["status"]) in {"completed", "failed"}
        ]
