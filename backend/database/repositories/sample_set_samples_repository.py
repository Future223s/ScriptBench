from __future__ import annotations

from typing import Any

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.sample_set_samples_table import sample_set_samples


class SampleSetSamplesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_for_sample_set(
        self, sample_set_id: int, conn: Connection | None = None
    ) -> list[dict[str, Any]]:
        stmt = (
            select(sample_set_samples)
            .where(sample_set_samples.c.sample_set_id == sample_set_id)
            .order_by(
                sample_set_samples.c.position.asc(),
                sample_set_samples.c.sample_id.asc(),
            )
        )

        def run(connection: Connection) -> list[dict[str, Any]]:
            return [dict(row) for row in connection.execute(stmt).mappings().all()]

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> None:
        def run(connection: Connection) -> None:
            connection.execute(insert(sample_set_samples).values(**row))

        if conn is not None:
            run(conn)
            return
        with self.engine.begin() as connection:
            run(connection)

    def delete_for_sample_set(
        self, sample_set_id: int, conn: Connection | None = None
    ) -> int:
        def run(connection: Connection) -> int:
            result = connection.execute(
                delete(sample_set_samples).where(
                    sample_set_samples.c.sample_set_id == sample_set_id
                )
            )
            return int(result.rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
