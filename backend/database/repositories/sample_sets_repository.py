from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.sample_sets_table import sample_sets


class SampleSetsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert_sample_set(
        self,
        *,
        sample_set_name: str,
        sample_set_description: str | None = None,
        sample_set_type: str | None = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        stmt = sample_sets.insert().values(
            sample_set_name=sample_set_name,
            sample_set_description=sample_set_description,
            sample_set_type=sample_set_type,
            created_at=now,
            updated_at=now,
        )
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
            return int(result.inserted_primary_key[0])

    def fetch_sample_set(self, sample_set_id: int) -> RowMapping | None:
        stmt = select(sample_sets).where(sample_sets.c.sample_set_id == sample_set_id)
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def list_sample_sets(self) -> list[RowMapping]:
        stmt = select(sample_sets).order_by(
            sample_sets.c.updated_at.desc(),
            sample_sets.c.sample_set_id.desc(),
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def update_sample_set(
        self,
        sample_set_id: int,
        **fields: Any,
    ) -> None:
        if not fields:
            return

        update_fields = dict(fields)
        update_fields.pop("sample_set_id", None)
        stmt = (
            sample_sets.update()
            .where(sample_sets.c.sample_set_id == sample_set_id)
            .values(**update_fields, updated_at=datetime.now(timezone.utc))
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def delete_sample_set(self, sample_set_id: int) -> int:
        stmt = delete(sample_sets).where(sample_sets.c.sample_set_id == sample_set_id)
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
        return int(result.rowcount or 0)
