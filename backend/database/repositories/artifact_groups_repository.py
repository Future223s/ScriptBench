from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.artifact_groups_table import artifact_groups


class ArtifactGroupsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def fetch_artifact_group(self, artifact_group_id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                select(artifact_groups).where(artifact_groups.c.artifact_group_id == artifact_group_id)
            ).fetchone()
        return dict(row._mapping) if row is not None else None

    def list_artifact_groups(
        self,
        *,
        query: str | None = None,
        mapping_type: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            artifact_groups.c.artifact_group_id,
            artifact_groups.c.artifact_group_name,
            artifact_groups.c.artifact_group_description,
            artifact_groups.c.mapping_type,
            artifact_groups.c.status,
            artifact_groups.c.created_at,
        ).order_by(
            artifact_groups.c.artifact_group_name.asc(),
            artifact_groups.c.artifact_group_id.asc(),
        )

        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                func.lower(artifact_groups.c.artifact_group_name).like(pattern)
                | func.lower(artifact_groups.c.artifact_group_description).like(pattern)
            )

        normalized_mapping_type = (mapping_type or "").strip()
        if normalized_mapping_type:
            stmt = stmt.where(artifact_groups.c.mapping_type == normalized_mapping_type)

        normalized_status = (status or "").strip()
        if normalized_status:
            stmt = stmt.where(artifact_groups.c.status == normalized_status)

        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_artifact_groups_by_names(self, artifact_group_names: Sequence[str]) -> list[dict[str, Any]]:
        names = [str(artifact_group_name).strip() for artifact_group_name in artifact_group_names if str(artifact_group_name).strip()]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(artifact_groups).where(artifact_groups.c.artifact_group_name.in_(names))
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(insert(artifact_groups).values(**row))
        else:
            result = conn.execute(insert(artifact_groups).values(**row))
        inserted_id = result.inserted_primary_key[0] if result.inserted_primary_key else None
        if inserted_id is None:
            raise ValueError("Failed to insert artifact group")
        return int(inserted_id)

    def update(self, artifact_group_id: int, row: dict[str, object], conn: Connection | None = None) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(
                    artifact_groups.update().where(artifact_groups.c.artifact_group_id == artifact_group_id).values(**row)
                )
        else:
            result = conn.execute(
                artifact_groups.update().where(artifact_groups.c.artifact_group_id == artifact_group_id).values(**row)
            )
        return int(result.rowcount or 0)

    def delete_artifact_group(self, artifact_group_id: int, conn: Connection | None = None) -> int:
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(delete(artifact_groups).where(artifact_groups.c.artifact_group_id == artifact_group_id))
        else:
            result = conn.execute(delete(artifact_groups).where(artifact_groups.c.artifact_group_id == artifact_group_id))
        return int(result.rowcount or 0)

    def delete_artifact_groups(self, artifact_group_ids: Sequence[int], conn: Connection | None = None) -> int:
        ids = [int(artifact_group_id) for artifact_group_id in artifact_group_ids]
        if not ids:
            return 0
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(delete(artifact_groups).where(artifact_groups.c.artifact_group_id.in_(ids)))
        else:
            result = conn.execute(delete(artifact_groups).where(artifact_groups.c.artifact_group_id.in_(ids)))
        return int(result.rowcount or 0)
