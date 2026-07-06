from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from ..tables.sample_uploads_table import sample_uploads


class SampleUploadsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def upsert_sample_upload(
        self,
        *,
        sample_id: str,
        model_family: str,
        upload_ref: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        insert_stmt = (
            postgresql_insert(sample_uploads)
            if self.engine.dialect.name == "postgresql"
            else sqlite_insert(sample_uploads)
        )
        stmt = insert_stmt.values(
            sample_id=sample_id,
            model_family=model_family,
            upload_ref=upload_ref,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[sample_uploads.c.model_family, sample_uploads.c.sample_id],
            set_={
                "upload_ref": stmt.excluded.upload_ref,
                "updated_at": now,
            },
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def get_sample_upload_refs(
        self,
        sample_ids: Sequence[str],
        model_family: str,
    ) -> dict[str, str]:
        if not sample_ids:
            return {}

        stmt = select(sample_uploads.c.sample_id, sample_uploads.c.upload_ref).where(
            sample_uploads.c.sample_id.in_(list(sample_ids)),
            sample_uploads.c.model_family == model_family,
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).all()
        return {str(sample_id): str(upload_ref) for sample_id, upload_ref in rows}

    def get_sample_upload_records(
        self,
        sample_ids: Sequence[str],
        model_family: str,
    ) -> dict[str, dict[str, Any]]:
        if not sample_ids:
            return {}

        stmt = select(
            sample_uploads.c.sample_id,
            sample_uploads.c.upload_ref,
            sample_uploads.c.updated_at,
        ).where(
            sample_uploads.c.sample_id.in_(list(sample_ids)),
            sample_uploads.c.model_family == model_family,
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return {
            str(row["sample_id"]): {
                "upload_ref": str(row["upload_ref"]),
                "updated_at": row["updated_at"],
            }
            for row in rows
        }
