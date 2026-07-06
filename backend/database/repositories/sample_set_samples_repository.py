from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.engine import Engine

from ..tables.sample_set_samples_table import sample_set_samples


class SampleSetSamplesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def replace_sample_set_samples(
        self,
        *,
        sample_set_id: int,
        sample_ids: Sequence[str],
    ) -> None:
        now = datetime.now(timezone.utc)
        rows = [
            {
                "sample_set_id": sample_set_id,
                "sample_id": sample_id,
                "position": index + 1,
                "created_at": now,
            }
            for index, sample_id in enumerate(sample_ids)
        ]
        with self.engine.begin() as conn:
            conn.execute(
                delete(sample_set_samples).where(
                    sample_set_samples.c.sample_set_id == sample_set_id
                )
            )
            if rows:
                conn.execute(sample_set_samples.insert().values(rows))

    def fetch_sample_set_sample_ids(self, sample_set_id: int) -> list[str]:
        stmt = (
            select(sample_set_samples.c.sample_id)
            .where(sample_set_samples.c.sample_set_id == sample_set_id)
            .order_by(sample_set_samples.c.position, sample_set_samples.c.sample_id)
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).all()
        return [str(sample_id) for (sample_id,) in rows]
