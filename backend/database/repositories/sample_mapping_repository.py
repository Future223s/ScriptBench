from __future__ import annotations

from sqlalchemy import delete, insert
from sqlalchemy.engine import Connection, Engine

from ..tables.sample_mapping_table import sample_mapping


class SampleMappingRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> None:
        if conn is None:
            with self.engine.begin() as conn:
                conn.execute(insert(sample_mapping).values(**row))
        else:
            conn.execute(insert(sample_mapping).values(**row))

    def delete_by_artifact_group_ids(self, artifact_group_ids: list[int], conn: Connection | None = None) -> int:
        if not artifact_group_ids:
            return 0
        if conn is None:
            with self.engine.begin() as conn:
                result = conn.execute(delete(sample_mapping).where(sample_mapping.c.artifact_group_id.in_(artifact_group_ids)))
        else:
            result = conn.execute(delete(sample_mapping).where(sample_mapping.c.artifact_group_id.in_(artifact_group_ids)))
        return int(result.rowcount or 0)
