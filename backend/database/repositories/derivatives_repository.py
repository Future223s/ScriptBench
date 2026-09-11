from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, or_, select, update
from ..tables.derivative_groups_table import derivative_groups
from sqlalchemy.engine import Connection, Engine

from ..tables.derivatives_table import derivatives
from ..tables.membership_mapping_table import membership_mapping
from ..tables.sample_mapping_table import sample_mapping
from ..tables.samples_table import samples

logger = logging.getLogger(__name__)


class DerivativesRepository:
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

    def list_derivatives(
        self,
        *,
        query: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            derivatives.c.id,
            derivatives.c.name,
            derivatives.c.sample_id,
            derivatives.c.derivative_group_id,
            derivatives.c.category,
            derivatives.c.mime_type,
            derivatives.c.updated_at,
        ).select_from(derivatives.outerjoin(derivative_groups, derivatives.c.derivative_group_id == derivative_groups.c.id)).order_by(
            derivatives.c.updated_at.desc(),
            derivatives.c.id.asc(),
        )
        normalized_query = (query or "").strip()
        if normalized_query:
            pattern = f"%{normalized_query.casefold()}%"
            stmt = stmt.where(
                or_(
                    func.lower(derivatives.c.name).like(pattern),
                    func.lower(derivatives.c.sample_id).like(pattern),
                    func.lower(func.coalesce(derivative_groups.c.name, "")).like(
                        pattern
                    ),
                )
            )
        if limit is not None:
            stmt = stmt.limit(limit)
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_derivative(self, id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                select(derivatives).where(derivatives.c.id == id)
            ).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_derivatives_by_name_and_sample(
        self,
        *,
        name: str,
        sample_id: str | None,
    ) -> list[dict[str, Any]]:
        stmt = select(derivatives).where(derivatives.c.name == name)
        if sample_id is not None:
            stmt = stmt.where(
                derivatives.c.sample_id == sample_id
            )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_derivative(self, row: dict[str, object]) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(insert(derivatives).values(**row))
            inserted_id = (
                result.inserted_primary_key[0] if result.inserted_primary_key else None
            )
        if inserted_id is None:
            raise ValueError("Failed to insert derivative")
        return int(inserted_id)

    def update_derivative(
        self,
        id: int,
        row: dict[str, object],
        conn: Connection | None = None,
    ) -> int:
        statement = (
            update(derivatives)
            .where(derivatives.c.id == id)
            .values(**row)
        )
        if conn is None:
            with self.engine.begin() as connection:
                result = connection.execute(statement)
        else:
            result = conn.execute(statement)
        return int(result.rowcount or 0)

    def update_blob(
        self, *, id: int, blob: bytes, mime_type: str | None
    ) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(derivatives)
                .where(derivatives.c.id == id)
                .values(
                    blob=blob,
                    mime_type=mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_derivative(self, id: int) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                delete(derivatives).where(derivatives.c.id == id)
            )
        return int(result.rowcount or 0)

    def delete_derivatives(self, ids: Sequence[int]) -> int:
        ids = [int(id) for id in ids]
        if not ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(
                delete(derivatives).where(derivatives.c.id.in_(ids))
            )
        return int(result.rowcount or 0)

    def fetch_membership_mapping_candidates(
        self, name: str
    ) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(membership_mapping)).fetchall()
        candidates = []
        comparison_candidates = self._comparison_candidates(name)
        for row in rows:
            mapping = dict(row._mapping)
            pattern = str(mapping.get("pattern") or "")
            operator = str(mapping.get("operator") or "")
            for comparison_value in comparison_candidates:
                if _matches_text(
                    comparison_value,
                    pattern,
                    operator,
                    bool(mapping.get("case_sensitive")),
                ):
                    logger.info(
                        "Derivative membership comparison matched (name=%s, comparison_value=%s, pattern=%s, operator=%s, case_sensitive=%s, derivative_group_id=%s)",
                        name,
                        comparison_value,
                        pattern,
                        operator,
                        bool(mapping.get("case_sensitive")),
                        mapping.get("derivative_group_id"),
                    )
                    candidates.append(mapping)
                    break
                logger.info(
                    "Derivative membership comparison missed (name=%s, comparison_value=%s, pattern=%s, operator=%s, case_sensitive=%s, derivative_group_id=%s)",
                    name,
                    comparison_value,
                    pattern,
                    operator,
                    bool(mapping.get("case_sensitive")),
                    mapping.get("derivative_group_id"),
                )
        return candidates

    def fetch_membership_mappings(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(membership_mapping)).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample_mapping_by_group_ids(
        self, derivative_group_ids: Sequence[int]
    ) -> list[dict[str, Any]]:
        ids = [int(derivative_group_id) for derivative_group_id in derivative_group_ids]
        if not ids:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(sample_mapping).where(
                    sample_mapping.c.derivative_group_id.in_(ids)
                )
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_sample_mappings(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(sample_mapping)).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_samples_for_names(
        self, sample_names: Sequence[str]
    ) -> list[dict[str, Any]]:
        names = [
            str(name).strip()
            for name in sample_names
            if str(name).strip()
        ]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(samples).where(samples.c.name.in_(names))
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_samples(self) -> list[dict[str, Any]]:
        with self.engine.begin() as conn:
            rows = conn.execute(select(samples)).fetchall()
        return [dict(row._mapping) for row in rows]


def _matches_text(
    value: str, pattern: str, operator: str, case_sensitive: bool
) -> bool:
    lhs = value if case_sensitive else value.casefold()
    rhs = pattern if case_sensitive else pattern.casefold()
    if operator == "equals":
        return lhs == rhs
    if operator == "starts_with":
        return lhs.startswith(rhs)
    if operator == "ends_with":
        return lhs.endswith(rhs)
    return rhs in lhs
