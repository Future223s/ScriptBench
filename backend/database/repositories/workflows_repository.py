from __future__ import annotations

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import Connection, Engine

from ..tables.workflows_table import workflows
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_steps_table import workflow_steps


class WorkflowsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(workflows).values(**row).returning(workflows.c.workflow_id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def fetch(self, workflow_id: int):
        with self.engine.connect() as connection:
            return (
                connection.execute(
                    select(workflows).where(workflows.c.workflow_id == workflow_id)
                )
                .mappings()
                .first()
            )

    def list(self) -> list[dict[str, object]]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(workflows).order_by(
                        workflows.c.workflow_name.asc(), workflows.c.workflow_id.asc()
                    )
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def update(self, workflow_id: int, row: dict[str, object]) -> int:
        with self.engine.begin() as connection:
            result = connection.execute(
                update(workflows)
                .where(workflows.c.workflow_id == workflow_id)
                .values(**row, updated_at=func.current_timestamp())
            )
        return int(result.rowcount or 0)

    def delete(self, workflow_id: int, conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            step_ids = (
                connection.execute(
                    select(workflow_dag_nodes.c.workflow_step_id).where(
                        workflow_dag_nodes.c.workflow_id == workflow_id
                    )
                )
                .scalars()
                .all()
            )
            result = connection.execute(
                delete(workflows).where(workflows.c.workflow_id == workflow_id)
            )
            for workflow_step_id in set(step_ids):
                still_used = connection.execute(
                    select(workflow_dag_nodes.c.workflow_dag_node_id)
                    .where(workflow_dag_nodes.c.workflow_step_id == workflow_step_id)
                    .limit(1)
                ).scalar_one_or_none()
                if still_used is None:
                    connection.execute(
                        delete(workflow_steps).where(
                            workflow_steps.c.workflow_step_id == workflow_step_id
                        )
                    )
            return int(result.rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
