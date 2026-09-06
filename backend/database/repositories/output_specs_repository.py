from __future__ import annotations

from sqlalchemy import insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.output_specs_table import output_specs


class OutputSpecsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(output_specs)
                    .values(**row)
                    .returning(output_specs.c.output_spec_id)
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
                        output_specs.c.output_spec_id == output_spec_id
                    )
                )
                .mappings()
                .first()
            )

    def list(self) -> list:
        with self.engine.connect() as connection:
            return list(
                connection.execute(
                    select(output_specs).order_by(output_specs.c.output_spec_name)
                )
                .mappings()
                .all()
            )
