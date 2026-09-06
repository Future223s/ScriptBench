from __future__ import annotations

from sqlalchemy import insert, select, update
from sqlalchemy.engine import Engine

from ..tables.object_uploads_table import object_uploads


class ObjectUploadsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(object_uploads).values(**row))

    def fetch(self, *, object_type: str, object_id: str, model_family: str):
        with self.engine.connect() as connection:
            row = (
                connection.execute(
                    select(object_uploads).where(
                        object_uploads.c.object_type == object_type,
                        object_uploads.c.object_id == object_id,
                        object_uploads.c.model_family == model_family,
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row is not None else None

    def upsert(
        self,
        *,
        object_type: str,
        object_id: str,
        model_family: str,
        upload_ref: str,
    ) -> None:
        with self.engine.begin() as connection:
            existing = connection.execute(
                select(object_uploads.c.upload_id).where(
                    object_uploads.c.object_type == object_type,
                    object_uploads.c.object_id == object_id,
                    object_uploads.c.model_family == model_family,
                )
            ).scalar_one_or_none()
            values = {
                "object_type": object_type,
                "object_id": object_id,
                "model_family": model_family,
                "upload_ref": upload_ref,
            }
            if existing is None:
                connection.execute(insert(object_uploads).values(**values))
            else:
                connection.execute(
                    update(object_uploads)
                    .where(object_uploads.c.upload_id == existing)
                    .values(upload_ref=upload_ref)
                )
