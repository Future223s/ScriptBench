from __future__ import annotations

from sqlalchemy import insert
from sqlalchemy.engine import Engine

from ..tables.sample_sets_table import sample_sets


class SampleSetsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(sample_sets).values(**row))
