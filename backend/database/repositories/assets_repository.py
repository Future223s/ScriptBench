from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import Engine

from ..tables.assets_table import assets


class AssetsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_assets(
        self,
        *,
        name: str | None = None,
        type: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            assets.c.id,
            assets.c.name,
            assets.c.type,
            assets.c.mime_type,
            assets.c.created_at,
            assets.c.updated_at,
            func.length(assets.c.blob).label("blob_size"),
            assets.c.blob.is_not(None).label("has_blob"),
        ).order_by(
            assets.c.name.asc(),
            assets.c.id.asc(),
        )
        normalized_name = (name or "").strip()
        if normalized_name:
            pattern = f"%{normalized_name.casefold()}%"
            stmt = stmt.where(func.lower(assets.c.name).like(pattern))

        normalized_type = (type or "").strip()
        if normalized_type:
            pattern = f"%{normalized_type.casefold()}%"
            stmt = stmt.where(func.lower(assets.c.type).like(pattern))

        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_asset(self, asset_id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(
                select(assets).where(assets.c.id == asset_id)
            ).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_assets_by_names(self, asset_names: Sequence[str]) -> list[dict[str, Any]]:
        names = [
            str(name).strip()
            for name in asset_names
            if str(name).strip()
        ]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(assets).where(assets.c.name.in_(names))
            ).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_asset_metadata(self, *, name: str, type: str) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                insert(assets).values(
                    name=name,
                    type=type,
                    blob=None,
                    mime_type=None,
                )
            )
            inserted_id = (
                result.inserted_primary_key[0] if result.inserted_primary_key else None
            )
        if inserted_id is None:
            raise ValueError("Failed to insert asset metadata")
        return int(inserted_id)

    def update_asset_blob(
        self,
        *,
        asset_id: int,
        blob: bytes,
        mime_type: str | None,
    ) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(assets)
                .where(assets.c.id == asset_id)
                .values(
                    blob=blob,
                    mime_type=mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_asset(self, asset_id: int) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(delete(assets).where(assets.c.id == asset_id))
        return int(result.rowcount or 0)

    def delete_assets(self, asset_ids: Sequence[int]) -> int:
        ids = [int(asset_id) for asset_id in asset_ids]
        if not ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(delete(assets).where(assets.c.id.in_(ids)))
        return int(result.rowcount or 0)
