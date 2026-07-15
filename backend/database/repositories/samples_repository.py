from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.engine import Engine

from ..tables.samples_table import samples


class SamplesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_samples(
        self,
        *,
        query: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = stmt = select(
            samples.c.sample_id,
            samples.c.sample_name,
            samples.c.sample_mime_type,
            samples.c.created_at,
            samples.c.updated_at,
        ).order_by(
            samples.c.created_at.desc(),
            samples.c.sample_id.asc(),
        )
        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                or_(
                    func.lower(samples.c.sample_id).like(pattern),
                    func.lower(samples.c.sample_name).like(pattern),
                    func.lower(func.coalesce(samples.c.ground_truth_text, "")).like(pattern),
                ) 
            )
            
        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample(self, sample_id: str) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(select(samples).where(samples.c.sample_id == sample_id)).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_samples_by_names(self, sample_names: Sequence[str]) -> list[dict[str, Any]]:
        names = [str(sample_name).strip() for sample_name in sample_names if str(sample_name).strip()]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(select(samples).where(samples.c.sample_name.in_(names))).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_sample_metadata(
        self,
        *,
        sample_id: str,
        sample_name: str,
        ground_truth_text: str | None = None,
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                insert(samples).values(
                    sample_id=sample_id,
                    sample_name=sample_name,
                    sample_blob=None,
                    sample_mime_type=None,
                    ground_truth_text=ground_truth_text,
                )
            )

    def update_sample_blob(
        self,
        *,
        sample_id: str,
        sample_blob: bytes,
        sample_mime_type: str | None,
    ) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(samples)
                .where(samples.c.sample_id == sample_id)
                .values(
                    sample_blob=sample_blob,
                    sample_mime_type=sample_mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_sample(self, sample_id: str) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(delete(samples).where(samples.c.sample_id == sample_id))
        return int(result.rowcount or 0)
