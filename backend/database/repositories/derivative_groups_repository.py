from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.derivative_groups_table import derivative_groups


class DerivativeGroupsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def fetch_derivative_group(self, id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                select(derivative_groups).where(
                    derivative_groups.c.id == id
                )
            ).fetchone()
        return dict(row._mapping) if row is not None else None

    def list_derivative_groups(
        self,
        *,
        query: str | None = None,
        mapping_type: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            derivative_groups.c.id,
            derivative_groups.c.name,
            derivative_groups.c.description,
            derivative_groups.c.mapping_type,
            derivative_groups.c.status,
            derivative_groups.c.created_at,
        ).order_by(
            derivative_groups.c.name.asc(),
            derivative_groups.c.id.asc(),
        )

        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                func.lower(derivative_groups.c.name).like(pattern)
                | func.lower(derivative_groups.c.description).like(pattern)
            )

        normalized_mapping_type = (mapping_type or "").strip()
        if normalized_mapping_type:
            stmt = stmt.where(derivative_groups.c.mapping_type == normalized_mapping_type)

        normalized_status = (status or "").strip()
        if normalized_status:
            stmt = stmt.where(derivative_groups.c.status == normalized_status)

        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_derivative_groups_by_names(
        self, names: Sequence[str]
    ) -> list[dict[str, Any]]:
        names = [
            str(name).strip()
            for name in names
            if str(name).strip()
        ]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(derivative_groups).where(
                    derivative_groups.c.name.in_(names)
                )
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def list_mapping_rules(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(derivative_groups)).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(insert(derivative_groups).values(**row))
        else:
            result = conn.execute(insert(derivative_groups).values(**row))
        inserted_id = (
            result.inserted_primary_key[0] if result.inserted_primary_key else None
        )
        if inserted_id is None:
            raise ValueError("Failed to insert derivative group")
        return int(inserted_id)

    def update(
        self,
        id: int,
        row: dict[str, object],
        conn: Connection | None = None,
    ) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(
                    derivative_groups.update()
                    .where(derivative_groups.c.id == id)
                    .values(**row)
                )
        else:
            result = conn.execute(
                derivative_groups.update()
                .where(derivative_groups.c.id == id)
                .values(**row)
            )
        return int(result.rowcount or 0)

    def delete_derivative_group(
        self, id: int, conn: Connection | None = None
    ) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(
                    delete(derivative_groups).where(
                        derivative_groups.c.id == id
                    )
                )
        else:
            result = conn.execute(
                delete(derivative_groups).where(
                    derivative_groups.c.id == id
                )
            )
        return int(result.rowcount or 0)

    def delete_derivative_groups(
        self, ids: Sequence[int], conn: Connection | None = None
    ) -> int:
        ids = [int(id) for id in ids]
        if not ids:
            return 0
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(
                    delete(derivative_groups).where(
                        derivative_groups.c.id.in_(ids)
                    )
                )
        else:
            result = conn.execute(
                delete(derivative_groups).where(
                    derivative_groups.c.id.in_(ids)
                )
            )
        return int(result.rowcount or 0)
