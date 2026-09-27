from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.engine import Engine

from backend.services.file_naming import natural_sort_key, parse_sample_name

from ..tables.documents_table import documents
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
        stmt = select(
            samples.c.id,
            samples.c.name,
            samples.c.mime_type,
            samples.c.ground_truth_text,
            samples.c.document_id,
            samples.c.document_position,
            samples.c.created_at,
            samples.c.updated_at,
        ).order_by(
            samples.c.created_at.desc(),
            samples.c.id.asc(),
        )
        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                or_(
                    func.lower(samples.c.id).like(pattern),
                    func.lower(samples.c.name).like(pattern),
                    func.lower(func.coalesce(samples.c.ground_truth_text, "")).like(
                        pattern
                    ),
                )
            )

        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample(self, sample_id: str) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                select(samples).where(samples.c.id == sample_id)
            ).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_ground_truth_text(self, sample_id: str) -> str | None:
        with self.engine.connect() as conn:
            value = conn.execute(
                select(samples.c.ground_truth_text).where(samples.c.id == sample_id)
            ).scalar_one_or_none()
        return str(value) if value is not None else None

    def fetch_samples_by_names(
        self, sample_names: Sequence[str]
    ) -> list[dict[str, Any]]:
        names = [
            str(name).strip()
            for name in sample_names
            if str(name).strip()
        ]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(samples).where(samples.c.name.in_(names))
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_sample_metadata(
        self,
        *,
        sample_id: str,
        name: str,
        ground_truth_text: str | None = None,
        document_id: str | None = None,
    ) -> None:
        with self.engine.begin() as conn:
            if document_id is not None:
                existing_document = conn.execute(
                    select(documents.c.id).where(documents.c.id == document_id)
                ).scalar_one_or_none()
                if existing_document is None:
                    conn.execute(
                        insert(documents).values(
                            id=document_id,
                            name=document_id,
                            metadata={"source": "sample-naming"},
                        )
                    )
            conn.execute(
                insert(samples).values(
                    id=sample_id,
                    name=name,
                    document_id=document_id,
                    blob=None,
                    mime_type=None,
                    ground_truth_text=ground_truth_text,
                )
            )
            if document_id is not None:
                self._reorder_document_pages(conn, document_id)

    def update_sample_blob(
        self,
        *,
        sample_id: str,
        blob: bytes,
        mime_type: str | None,
    ) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(samples)
                .where(samples.c.id == sample_id)
                .values(
                    blob=blob,
                    mime_type=mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_sample(self, sample_id: str) -> int:
        with self.engine.begin() as conn:
            document_id = conn.execute(
                select(samples.c.document_id).where(samples.c.id == sample_id)
            ).scalar_one_or_none()
            result = conn.execute(
                delete(samples).where(samples.c.id == sample_id)
            )
            if document_id is not None:
                self._reorder_document_pages(conn, str(document_id))
        return int(result.rowcount or 0)

    def _reorder_document_pages(self, conn, document_id: str) -> None:
        page_rows = conn.execute(
            select(samples.c.id, samples.c.name).where(
                samples.c.document_id == document_id
            )
        ).mappings().all()
        ordered = sorted(
            page_rows,
            key=lambda row: (
                natural_sort_key(parse_sample_name(str(row["name"])).page),
                str(row["id"]),
            ),
        )
        for position, row in enumerate(ordered):
            conn.execute(
                update(samples)
                .where(samples.c.id == row["id"])
                .values(document_position=position)
            )
