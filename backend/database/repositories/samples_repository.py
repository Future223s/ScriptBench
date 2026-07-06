from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.samples_table import samples


class SamplesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def upsert_sample(
        self,
        *,
        sample_id: str,
        sample_group: str | None = None,
        sample_groups: Mapping[str, object] | None = None,
        sample_blob: bytes | None = None,
        sample_mime_type: str | None = None,
        ground_truth_text: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        insert_stmt = (
            postgresql_insert(samples)
            if self.engine.dialect.name == "postgresql"
            else sqlite_insert(samples)
        )
        stmt = insert_stmt.values(
            sample_id=sample_id,
            sample_group=sample_group,
            sample_groups=dict(sample_groups or {}),
            sample_blob=sample_blob,
            sample_mime_type=sample_mime_type,
            ground_truth_text=ground_truth_text,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[samples.c.sample_id],
            set_={
                "sample_group": stmt.excluded.sample_group,
                "sample_groups": stmt.excluded.sample_groups,
                "sample_blob": stmt.excluded.sample_blob,
                "sample_mime_type": stmt.excluded.sample_mime_type,
                "ground_truth_text": stmt.excluded.ground_truth_text,
                "updated_at": now,
            },
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def fetch_sample(self, sample_id: str) -> RowMapping | None:
        stmt = select(samples).where(samples.c.sample_id == sample_id)
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def list_samples(self, sample_group: str | None = None) -> list[RowMapping]:
        stmt = select(samples)
        if sample_group is not None:
            stmt = stmt.where(samples.c.sample_group == sample_group)
        stmt = stmt.order_by(samples.c.sample_id)
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def delete_sample(self, sample_id: str) -> int:
        stmt = delete(samples).where(samples.c.sample_id == sample_id)
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
        return int(result.rowcount or 0)

    def assign_sample_group_values(
        self,
        *,
        group_name: str,
        assignments: Mapping[str, object],
    ) -> list[str]:
        now = datetime.now(timezone.utc)
        missing_sample_ids: list[str] = []

        with self.engine.begin() as conn:
            for sample_id, value in assignments.items():
                row = conn.execute(
                    select(samples.c.sample_groups).where(samples.c.sample_id == sample_id)
                ).mappings().one_or_none()
                if row is None:
                    missing_sample_ids.append(sample_id)
                    continue

                sample_groups = dict(row["sample_groups"] or {})
                sample_groups[group_name] = value
                conn.execute(
                    samples.update()
                    .where(samples.c.sample_id == sample_id)
                    .values(sample_groups=sample_groups, updated_at=now)
                )

        return missing_sample_ids

    def delete_grouping(self, group_name: str) -> int:
        now = datetime.now(timezone.utc)
        updated_rows = 0

        with self.engine.begin() as conn:
            rows = conn.execute(
                select(
                    samples.c.sample_id,
                    samples.c.sample_group,
                    samples.c.sample_groups,
                )
            ).mappings().all()

            for row in rows:
                sample_id = str(row["sample_id"])
                sample_group = row["sample_group"]
                sample_groups = dict(row["sample_groups"] or {})
                changed = False

                if sample_group == group_name:
                    sample_group = None
                    changed = True

                if group_name in sample_groups:
                    sample_groups.pop(group_name, None)
                    changed = True

                if not changed:
                    continue

                conn.execute(
                    samples.update()
                    .where(samples.c.sample_id == sample_id)
                    .values(
                        sample_group=sample_group,
                        sample_groups=sample_groups,
                        updated_at=now,
                    )
                )
                updated_rows += 1

        return updated_rows

    def assign_samples_to_group(
        self,
        *,
        group_name: str,
        sample_ids: Sequence[str],
    ) -> list[str]:
        return self.assign_sample_group_values(
            group_name=group_name,
            assignments={sample_id: "" for sample_id in sample_ids},
        )
