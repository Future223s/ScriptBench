from __future__ import annotations

from sqlalchemy import insert
from sqlalchemy.engine import Engine

from ..tables.workflow_steps_table import workflow_steps


class WorkflowStepsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(workflow_steps).values(**row))
