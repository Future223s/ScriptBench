from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, File, HTTPException, Path as FastAPIPath, Query, UploadFile

from backend.api.dependencies import get_engine, row_to_dict
from backend.database.repositories.assets_repository import AssetsRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.assets import (
    AssetBlobUploadResponse,
    AssetCreateRequest,
    AssetDeleteRequest,
    AssetRecord,
    AssetResponse,
    AssetSummaryResponse,
)

router = APIRouter(tags=["assets-v2"])
logger = logging.getLogger(__name__)


def _asset_summary_payload(row: dict[str, object]) -> dict[str, object]:
    payload = row_to_dict(row, exclude={"asset_blob"})
    asset_blob = row.get("asset_blob")
    asset_blob_size = len(asset_blob) if asset_blob is not None else 0
    payload["has_asset_blob"] = asset_blob is not None
    payload["asset_blob_size"] = asset_blob_size
    return payload


def _asset_detail_payload(row: dict[str, object]) -> dict[str, object]:
    payload = _asset_summary_payload(row)
    asset_blob = row.get("asset_blob")
    payload["asset_blob_base64"] = row_to_dict({"asset_blob": asset_blob})["asset_blob"] if asset_blob is not None else None
    return payload


@router.get("/api/v2/assets", response_model=ApiListResponse[AssetSummaryResponse])
def list_assets(
    engine=Depends(get_engine),
    asset_name: str | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[AssetSummaryResponse]:
    assets_repository = AssetsRepository(engine)
    asset_rows = assets_repository.list_assets(asset_name=asset_name, asset_type=asset_type, limit=limit)
    items = [AssetSummaryResponse.model_validate(_asset_summary_payload(row)) for row in asset_rows]
    logger.info(
        "Listed asset records from v2 assets endpoint (asset_count=%s, asset_name=%s, asset_type=%s, limit=%s)",
        len(items),
        asset_name,
        asset_type,
        limit,
    )
    return ApiListResponse[AssetSummaryResponse](
        message="Assets retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get("/api/v2/assets/{asset_id}", response_model=ApiResponse[AssetResponse])
def get_asset(
    asset_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[AssetResponse]:
    assets_repository = AssetsRepository(engine)
    row = assets_repository.fetch_asset(asset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_response = AssetResponse.model_validate(_asset_detail_payload(row))
    logger.info("Loaded asset record from v2 assets endpoint (asset_id=%s)", asset_id)
    return ApiResponse[AssetResponse](
        message="Asset retrieved successfully.",
        data=asset_response,
    )


@router.post("/api/v2/assets", response_model=ApiResponse[AssetResponse])
def create_asset(
    payload: AssetCreateRequest,
    engine=Depends(get_engine),
) -> ApiResponse[AssetResponse]:
    assets_repository = AssetsRepository(engine)
    asset_name = payload.asset_name.strip()
    asset_type = payload.asset_type.strip()
    if not asset_name:
        raise HTTPException(status_code=400, detail="asset_name is required")
    if not asset_type:
        raise HTTPException(status_code=400, detail="asset_type is required")

    if assets_repository.fetch_assets_by_names([asset_name]):
        raise HTTPException(status_code=409, detail=f"Asset already exists: {asset_name}")

    asset_id = assets_repository.insert_asset_metadata(asset_name=asset_name, asset_type=asset_type)
    row = assets_repository.fetch_asset(asset_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load asset after create")

    asset_response = AssetResponse.model_validate(_asset_detail_payload(row))
    logger.info("Created asset metadata row in v2 assets endpoint (asset_id=%s, asset_name=%s)", asset_id, asset_name)
    return ApiResponse[AssetResponse](
        message="Asset created successfully.",
        data=asset_response,
    )


@router.put("/api/v2/assets/{asset_id}/blob", response_model=ApiResponse[AssetBlobUploadResponse])
async def upload_asset_blob(
    asset_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
) -> ApiResponse[AssetBlobUploadResponse]:
    assets_repository = AssetsRepository(engine)
    asset_row = assets_repository.fetch_asset(asset_id)
    if asset_row is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_blob = await file.read()
    if not asset_blob:
        raise HTTPException(status_code=400, detail="Asset file is empty")

    updated = assets_repository.update_asset_blob(
        asset_id=asset_id,
        asset_blob=asset_blob,
        asset_mime_type=file.content_type,
    )
    if updated != 1:
        raise HTTPException(status_code=409, detail=f"Failed to update asset blob: {asset_id}")

    logger.info("Updated asset blob in v2 assets endpoint (asset_id=%s)", asset_id)
    return ApiResponse[AssetBlobUploadResponse](
        message="Asset blob uploaded successfully.",
        data=AssetBlobUploadResponse(asset_id=asset_id),
    )


@router.delete("/api/v2/assets/{asset_id}", response_model=ApiDeleteResponse)
def delete_asset(
    asset_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    assets_repository = AssetsRepository(engine)
    row = assets_repository.fetch_asset(asset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    references = assets_repository.fetch_fixed_payload_input_references([asset_id])
    if references:
        raise HTTPException(status_code=409, detail="Asset is referenced by a fixed payload input")

    deleted = assets_repository.delete_asset(asset_id)
    if deleted != 1:
        raise HTTPException(status_code=409, detail=f"Failed to delete asset: {asset_id}")

    logger.info("Deleted asset record from v2 assets endpoint (asset_id=%s)", asset_id)
    return ApiDeleteResponse(message="Asset deleted successfully.")


@router.delete("/api/v2/assets", response_model=ApiDeleteResponse)
def delete_assets(
    payload: AssetDeleteRequest = Body(...),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    asset_ids = [int(asset_id) for asset_id in payload.asset_ids]
    if not asset_ids:
        raise HTTPException(status_code=400, detail="asset_ids is required")

    assets_repository = AssetsRepository(engine)
    unique_asset_ids = list(dict.fromkeys(asset_ids))
    missing_asset_ids = [asset_id for asset_id in unique_asset_ids if assets_repository.fetch_asset(asset_id) is None]
    if missing_asset_ids:
        raise HTTPException(status_code=404, detail=f"Unknown asset_id(s): {', '.join(map(str, missing_asset_ids))}")

    referenced_rows = assets_repository.fetch_fixed_payload_input_references(unique_asset_ids)
    if referenced_rows:
        raise HTTPException(status_code=409, detail="One or more assets are referenced by a fixed payload input")

    deleted_count = assets_repository.delete_assets(unique_asset_ids)
    if deleted_count != len(unique_asset_ids):
        raise HTTPException(status_code=409, detail="Failed to delete all requested assets")

    logger.info("Deleted asset records from v2 assets endpoint (asset_count=%s)", deleted_count)
    return ApiDeleteResponse(message="Assets deleted successfully.")
