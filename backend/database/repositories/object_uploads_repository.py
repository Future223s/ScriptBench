from __future__ import annotations

from sqlalchemy import insert
from sqlalchemy.engine import Engine

from ..tables.object_uploads_table import object_uploads


class ObjectUploadsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(object_uploads).values(**row))
