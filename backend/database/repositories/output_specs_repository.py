from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.output_specs_table import output_specs
from ..tables.workflow_steps_table import workflow_steps


class OutputSpecsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(output_specs)
                    .values(**row)
                    .returning(output_specs.c.id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def fetch(self, output_spec_id: int):
        with self.engine.connect() as connection:
            return (
                connection.execute(
                    select(output_specs).where(
                        output_specs.c.id == output_spec_id
                    )
                )
                .mappings()
                .first()
            )

    def list(self) -> list:
        with self.engine.connect() as connection:
            return list(
                connection.execute(
                    select(output_specs).order_by(output_specs.c.name)
                )
                .mappings()
                .all()
            )

    def list_referencing_workflow_step_ids(
        self, output_spec_ids: list[int], conn: Connection | None = None
    ) -> list[int]:
        statement = select(workflow_steps.c.id).where(
            workflow_steps.c.output_spec_id.in_(output_spec_ids)
        )

        def run(connection: Connection) -> list[int]:
            return [int(value) for value in connection.execute(statement).scalars().all()]

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)

    def delete_many(
        self, output_spec_ids: list[int], conn: Connection | None = None
    ) -> int:
        statement = delete(output_specs).where(
            output_specs.c.id.in_(output_spec_ids)
        )

        def run(connection: Connection) -> int:
            return int(connection.execute(statement).rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
