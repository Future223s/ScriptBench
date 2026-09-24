from __future__ import annotations

from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import Connection, Engine

from ..tables.documents_table import documents
from ..tables.samples_table import samples


class DocumentsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list(self) -> list[dict[str, Any]]:
        sample_count = (
            select(func.count(samples.c.id))
            .where(samples.c.document_id == documents.c.id)
            .scalar_subquery()
        )
        statement = select(
            documents.c.id,
            documents.c.name,
            documents.c.metadata,
            documents.c.mime_type,
            documents.c.created_at,
            documents.c.updated_at,
            documents.c.blob.is_not(None).label("has_blob"),
            func.coalesce(func.length(documents.c.blob), 0).label("blob_size"),
            sample_count.label("sample_count"),
        ).order_by(documents.c.name, documents.c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        return [dict(row) for row in rows]

    def fetch(self, document_id: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(documents).where(documents.c.id == document_id)
            ).mappings().one_or_none()
            if row is None:
                return None
            page_rows = connection.execute(
                select(samples.c.id, samples.c.name)
                .where(samples.c.document_id == document_id)
                .order_by(samples.c.document_position, samples.c.name, samples.c.id)
            ).mappings().all()
        payload = dict(row)
        blob = payload.pop("blob")
        payload.update(
            {
                "has_blob": blob is not None,
                "blob_size": len(blob) if blob is not None else 0,
                "blob": blob,
                "sample_count": len(page_rows),
                "sample_ids": [str(page["id"]) for page in page_rows],
                "sample_names": [str(page["name"]) for page in page_rows],
            }
        )
        return payload

    def ensure(
        self,
        document_id: str,
        *,
        metadata: dict[str, Any] | None = None,
        connection: Connection | None = None,
    ) -> None:
        def execute(conn: Connection) -> None:
            existing = conn.execute(
                select(documents.c.id).where(documents.c.id == document_id)
            ).scalar_one_or_none()
            if existing is None:
                conn.execute(
                    insert(documents).values(
                        id=document_id,
                        name=document_id,
                        metadata=metadata,
                    )
                )
            elif metadata is not None:
                conn.execute(
                    update(documents)
                    .where(documents.c.id == document_id)
                    .values(metadata=metadata)
                )

        if connection is not None:
            execute(connection)
        else:
            with self.engine.begin() as conn:
                execute(conn)

    def update_blob(
        self,
        document_id: str,
        *,
        blob: bytes,
        mime_type: str,
        source: str,
    ) -> int:
        with self.engine.begin() as connection:
            existing_metadata = connection.execute(
                select(documents.c.metadata).where(documents.c.id == document_id)
            ).scalar_one_or_none()
            metadata = dict(existing_metadata or {})
            metadata["pdf_source"] = source
            result = connection.execute(
                update(documents)
                .where(documents.c.id == document_id)
                .values(blob=blob, mime_type=mime_type, metadata=metadata)
            )
        return int(result.rowcount or 0)

    def page_blobs(self, document_id: str) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            rows = connection.execute(
                select(samples.c.id, samples.c.name, samples.c.blob, samples.c.mime_type)
                .where(samples.c.document_id == document_id)
                .order_by(samples.c.document_position, samples.c.name, samples.c.id)
            ).mappings().all()
        return [dict(row) for row in rows]

    def delete(self, document_id: str) -> int:
        with self.engine.begin() as connection:
            sample_count = connection.execute(
                select(func.count(samples.c.id)).where(
                    samples.c.document_id == document_id
                )
            ).scalar_one()
            if sample_count:
                raise ValueError("Documents with pages cannot be deleted")
            result = connection.execute(
                delete(documents).where(documents.c.id == document_id)
            )
        return int(result.rowcount or 0)
