from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.engine import Engine

from ..tables.artifacts_table import artifacts
from ..tables.membership_mapping_table import membership_mapping
from ..tables.sample_mapping_table import sample_mapping
from ..tables.samples_table import samples

logger = logging.getLogger(__name__)


class ArtifactsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def _comparison_candidates(self, value: str) -> list[str]:
        normalized = str(value or "").strip()
        if not normalized:
            return []
        candidates = [normalized]
        cropped = re.sub(r"(_line_[0-9]+)$", "", normalized, flags=re.IGNORECASE)
        if cropped != normalized:
            candidates.append(cropped)
        return list(dict.fromkeys(candidates))

    def list_artifacts(
        self,
        *,
        query: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            artifacts.c.artifact_id,
            artifacts.c.artifact_name,
            artifacts.c.originating_sample_id,
            artifacts.c.artifact_group_id,
            artifacts.c.artifact_group_name,
            artifacts.c.updated_at,
        ).order_by(
            artifacts.c.updated_at.desc(),
            artifacts.c.artifact_id.asc(),
        )
        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                or_(
                    func.lower(artifacts.c.artifact_name).like(pattern),
                    func.lower(artifacts.c.originating_sample_id).like(pattern),
                    func.lower(func.coalesce(artifacts.c.artifact_group_name, "")).like(pattern),
                )
            )
        if limit is not None:
            stmt = stmt.limit(limit)
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_artifact(self, artifact_id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(select(artifacts).where(artifacts.c.artifact_id == artifact_id)).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_artifacts_by_name_and_sample(
        self,
        *,
        artifact_name: str,
        originating_sample_id: str | None,
    ) -> list[dict[str, Any]]:
        stmt = select(artifacts).where(artifacts.c.artifact_name == artifact_name)
        if originating_sample_id is not None:
            stmt = stmt.where(artifacts.c.originating_sample_id == originating_sample_id)
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_artifact(self, row: dict[str, object]) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(insert(artifacts).values(**row))
            inserted_id = result.inserted_primary_key[0] if result.inserted_primary_key else None
        if inserted_id is None:
            raise ValueError("Failed to insert artifact")
        return int(inserted_id)

    def update_artifact(self, artifact_id: int, row: dict[str, object]) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(update(artifacts).where(artifacts.c.artifact_id == artifact_id).values(**row))
        return int(result.rowcount or 0)

    def update_artifact_blob(self, *, artifact_id: int, artifact_blob: bytes, artifact_mime_type: str | None) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(artifacts)
                .where(artifacts.c.artifact_id == artifact_id)
                .values(
                    artifact_blob=artifact_blob,
                    artifact_mime_type=artifact_mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_artifact(self, artifact_id: int) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(delete(artifacts).where(artifacts.c.artifact_id == artifact_id))
        return int(result.rowcount or 0)

    def delete_artifacts(self, artifact_ids: Sequence[int]) -> int:
        ids = [int(artifact_id) for artifact_id in artifact_ids]
        if not ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(delete(artifacts).where(artifacts.c.artifact_id.in_(ids)))
        return int(result.rowcount or 0)

    def fetch_membership_mapping_candidates(self, artifact_name: str) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(membership_mapping)).fetchall()
        candidates = []
        comparison_candidates = self._comparison_candidates(artifact_name)
        for row in rows:
            mapping = dict(row._mapping)
            pattern = str(mapping.get("pattern") or "")
            operator = str(mapping.get("operator") or "")
            for comparison_value in comparison_candidates:
                if _matches_text(comparison_value, pattern, operator, bool(mapping.get("case_sensitive"))):
                    logger.info(
                        "Artifact membership comparison matched (artifact_name=%s, comparison_value=%s, pattern=%s, operator=%s, case_sensitive=%s, artifact_group_id=%s)",
                        artifact_name,
                        comparison_value,
                        pattern,
                        operator,
                        bool(mapping.get("case_sensitive")),
                        mapping.get("artifact_group_id"),
                    )
                    candidates.append(mapping)
                    break
                logger.info(
                    "Artifact membership comparison missed (artifact_name=%s, comparison_value=%s, pattern=%s, operator=%s, case_sensitive=%s, artifact_group_id=%s)",
                    artifact_name,
                    comparison_value,
                    pattern,
                    operator,
                    bool(mapping.get("case_sensitive")),
                    mapping.get("artifact_group_id"),
                )
        return candidates

    def fetch_membership_mappings(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(membership_mapping)).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample_mapping_by_group_ids(self, artifact_group_ids: Sequence[int]) -> list[dict[str, Any]]:
        ids = [int(artifact_group_id) for artifact_group_id in artifact_group_ids]
        if not ids:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(select(sample_mapping).where(sample_mapping.c.artifact_group_id.in_(ids))).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample_mappings(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(sample_mapping)).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_samples_for_names(self, sample_names: Sequence[str]) -> list[dict[str, Any]]:
        names = [str(sample_name).strip() for sample_name in sample_names if str(sample_name).strip()]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(select(samples).where(samples.c.sample_name.in_(names))).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_samples(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(samples)).fetchall()
        return [dict(row._mapping) for row in rows]


def _matches_text(value: str, pattern: str, operator: str, case_sensitive: bool) -> bool:
    lhs = value if case_sensitive else value.casefold()
    rhs = pattern if case_sensitive else pattern.casefold()
    if operator == "equals":
        return lhs == rhs
    if operator == "starts_with":
        return lhs.startswith(rhs)
    if operator == "ends_with":
        return lhs.endswith(rhs)
    return rhs in lhs
