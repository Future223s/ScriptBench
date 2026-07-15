from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import Engine

from ..tables.assets_table import assets
from ..tables.payload_inputs_table import payload_inputs


class AssetsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_assets(
        self,
        *,
        asset_name: str | None = None,
        asset_type: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(
            assets.c.asset_id,
            assets.c.asset_name,
            assets.c.asset_type,
            assets.c.asset_mime_type,
            assets.c.created_at,
            assets.c.updated_at,
            func.length(assets.c.asset_blob).label("asset_blob_size"),
        ).order_by(
            assets.c.asset_name.asc(),
            assets.c.asset_id.asc(),
        )
        normalized_name = (asset_name or "").strip()
        if normalized_name:
            pattern = f"%{normalized_name.casefold()}%"
            stmt = stmt.where(func.lower(assets.c.asset_name).like(pattern))

        normalized_type = (asset_type or "").strip()
        if normalized_type:
            pattern = f"%{normalized_type.casefold()}%"
            stmt = stmt.where(func.lower(assets.c.asset_type).like(pattern))

        if limit is not None:
            stmt = stmt.limit(limit)

        with self.engine.begin() as conn:
            rows = conn.execute(stmt).fetchall()
        return [dict(row._mapping) for row in rows]

    def fetch_asset(self, asset_id: int) -> dict[str, Any] | None:
        with self.engine.begin() as conn:
            row = conn.execute(select(assets).where(assets.c.asset_id == asset_id)).fetchone()
        return dict(row._mapping) if row is not None else None

    def fetch_assets_by_names(self, asset_names: Sequence[str]) -> list[dict[str, Any]]:
        names = [str(asset_name).strip() for asset_name in asset_names if str(asset_name).strip()]
        if not names:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(select(assets).where(assets.c.asset_name.in_(names))).fetchall()
        return [dict(row._mapping) for row in rows]

    def insert_asset_metadata(self, *, asset_name: str, asset_type: str) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                insert(assets).values(
                    asset_name=asset_name,
                    asset_type=asset_type,
                    asset_blob=None,
                    asset_mime_type=None,
                )
            )
            inserted_id = result.inserted_primary_key[0] if result.inserted_primary_key else None
        if inserted_id is None:
            raise ValueError("Failed to insert asset metadata")
        return int(inserted_id)

    def update_asset_blob(
        self,
        *,
        asset_id: int,
        asset_blob: bytes,
        asset_mime_type: str | None,
    ) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(
                update(assets)
                .where(assets.c.asset_id == asset_id)
                .values(
                    asset_blob=asset_blob,
                    asset_mime_type=asset_mime_type,
                )
            )
        return int(result.rowcount or 0)

    def delete_asset(self, asset_id: int) -> int:
        with self.engine.begin() as conn:
            result = conn.execute(delete(assets).where(assets.c.asset_id == asset_id))
        return int(result.rowcount or 0)

    def delete_assets(self, asset_ids: Sequence[int]) -> int:
        ids = [int(asset_id) for asset_id in asset_ids]
        if not ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(delete(assets).where(assets.c.asset_id.in_(ids)))
        return int(result.rowcount or 0)

    def fetch_fixed_payload_input_references(self, asset_ids: Sequence[int]) -> list[dict[str, Any]]:
        ids = [int(asset_id) for asset_id in asset_ids]
        if not ids:
            return []
        with self.engine.begin() as conn:
            rows = conn.execute(
                select(payload_inputs.c.source_object_id)
                .where(
                    payload_inputs.c.binding_mode == "fixed",
                    payload_inputs.c.source_type == "asset",
                    payload_inputs.c.source_object_id.in_([str(asset_id) for asset_id in ids]),
                )
            ).fetchall()
        return [dict(row._mapping) for row in rows]
