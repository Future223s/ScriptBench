from __future__ import annotations

from typing import Any

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.sample_sets_table import sample_sets
from ..tables.workflows_table import workflows
from .workflows_repository import WorkflowsRepository


class SampleSetsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def fetch(self, sample_set_id: int) -> dict[str, Any] | None:
        with self.engine.connect() as conn:
            row = (
                conn.execute(
                    select(sample_sets).where(
                        sample_sets.c.sample_set_id == sample_set_id
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row is not None else None

    def list(
        self,
        *,
        query: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(sample_sets).order_by(
            sample_sets.c.sample_set_name.asc(),
            sample_sets.c.sample_set_id.asc(),
        )
        normalized_query = (query or "").strip()
        if normalized_query:
            stmt = stmt.where(
                sample_sets.c.sample_set_name.ilike(f"%{normalized_query}%")
            )
        normalized_status = (status or "").strip()
        if normalized_status:
            stmt = stmt.where(sample_sets.c.status == normalized_status)
        if limit is not None:
            stmt = stmt.limit(limit)
        with self.engine.connect() as conn:
            rows = conn.execute(stmt).mappings().all()
        return [dict(row) for row in rows]

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            result = connection.execute(insert(sample_sets).values(**row))
            inserted_id = (
                result.inserted_primary_key[0] if result.inserted_primary_key else None
            )
            if inserted_id is None:
                raise ValueError("Failed to insert sample set")
            return int(inserted_id)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def delete(self, sample_set_id: int, conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            workflow_ids = (
                connection.execute(
                    select(workflows.c.workflow_id).where(
                        workflows.c.sample_set_id == sample_set_id
                    )
                )
                .scalars()
                .all()
            )
            workflows_repository = WorkflowsRepository(self.engine)
            for workflow_id in workflow_ids:
                workflows_repository.delete(int(workflow_id), conn=connection)
            result = connection.execute(
                delete(sample_sets).where(sample_sets.c.sample_set_id == sample_set_id)
            )
            return int(result.rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
