from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.workflow_steps_table import workflow_steps


class WorkflowStepsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(workflow_steps)
                    .values(**row)
                    .returning(workflow_steps.c.workflow_step_id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def fetch(self, workflow_step_id: int):
        with self.engine.connect() as connection:
            return (
                connection.execute(
                    select(workflow_steps).where(
                        workflow_steps.c.workflow_step_id == workflow_step_id
                    )
                )
                .mappings()
                .first()
            )

    def list(self) -> list[dict[str, object]]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(workflow_steps).order_by(
                        workflow_steps.c.step_name.asc(),
                        workflow_steps.c.workflow_step_id.asc(),
                    )
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def delete(self, workflow_step_id: int) -> bool:
        with self.engine.begin() as connection:
            result = connection.execute(
                delete(workflow_steps).where(
                    workflow_steps.c.workflow_step_id == workflow_step_id,
                ),
            )
        return result.rowcount > 0
