from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.engine import Engine

from ..tables.transcription_job_samples_table import transcription_job_samples


class TranscriptionJobSamplesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def add_transcription_job_samples(
        self,
        job_id: int,
        sample_ids: Sequence[str],
    ) -> None:
        if not sample_ids:
            return

        now = datetime.now(timezone.utc)
        rows = [
            {
                "job_id": job_id,
                "sample_id": sample_id,
                "created_at": now,
            }
            for sample_id in sample_ids
        ]
        stmt = transcription_job_samples.insert().values(rows)
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def fetch_transcription_job_samples(self, job_id: int) -> list[str]:
        stmt = (
            select(transcription_job_samples.c.sample_id)
            .where(transcription_job_samples.c.job_id == job_id)
            .order_by(transcription_job_samples.c.sample_id)
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).all()
        return [str(sample_id) for (sample_id,) in rows]
