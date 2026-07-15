from __future__ import annotations

from sqlalchemy import insert
from sqlalchemy.engine import Engine

from ..tables.workflows_table import workflows


class WorkflowsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(workflows).values(**row))
