from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, File, HTTPException, Path as FastAPIPath, Query, UploadFile

from backend.api.dependencies import get_engine
from backend.api.v2.endpoints._helpers import row_payload_with_blob_metadata
from backend.database.repositories.samples_repository import SamplesRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.samples import SampleBlobUploadResponse, SampleCreateRequest, SampleDeleteRequest, SampleResponse, SampleSummaryResponse

router = APIRouter(tags=["samples-v2"])
logger = logging.getLogger(__name__)


@router.get("/api/v2/samples", response_model=ApiListResponse[SampleSummaryResponse])
def list_samples(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[SampleSummaryResponse]:
    samples_repository = SamplesRepository(engine)
    sample_rows = samples_repository.list_samples(query=query, limit=limit)
    items = [
        SampleSummaryResponse.model_validate(row)
        for row in sample_rows
    ]
    logger.info("Listed sample records from v2 samples endpoint (sample_count=%s)", len(items))
    return ApiListResponse[SampleSummaryResponse](
        message="Samples retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get("/api/v2/samples/{sample_id}", response_model=ApiResponse[SampleResponse])
def get_sample(
    sample_id: str = FastAPIPath(..., min_length=1),
    engine=Depends(get_engine),
) -> ApiResponse[SampleResponse]:
    samples_repository = SamplesRepository(engine)
    row = samples_repository.fetch_sample(sample_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample_payload = row_payload_with_blob_metadata(
        row,
        blob_key="sample_blob",
        blob_prefix="sample",
        include_blob=True,
    )
    sample_response = SampleResponse.model_validate(sample_payload)
    logger.info("Loaded sample record from v2 samples endpoint (sample_id=%s)", sample_id)
    return ApiResponse[SampleResponse](
        message="Sample retrieved successfully.",
        data=sample_response,
    )


@router.post("/api/v2/samples", response_model=ApiResponse[SampleResponse])
def create_sample(
    payload: SampleCreateRequest,
    engine=Depends(get_engine),
) -> ApiResponse[SampleResponse]:
    samples_repository = SamplesRepository(engine)

    sample_id = payload.sample_id.strip()
    sample_name = payload.sample_name.strip()
    ground_truth_text = payload.ground_truth_text.strip() if payload.ground_truth_text is not None else None
    if not sample_id:
        raise HTTPException(status_code=400, detail="sample_id is required")
    if not sample_name:
        raise HTTPException(status_code=400, detail="sample_name is required")

    if samples_repository.fetch_sample(sample_id) is not None:
        raise HTTPException(status_code=409, detail=f"Sample already exists: {sample_id}")

    if samples_repository.fetch_samples_by_names([sample_name]):
        raise HTTPException(status_code=409, detail=f"Sample name already exists: {sample_name}")

    samples_repository.insert_sample_metadata(
        sample_id=sample_id,
        sample_name=sample_name,
        ground_truth_text=ground_truth_text or None,
    )
    created_row = samples_repository.fetch_sample(sample_id)
    if created_row is None:
        raise HTTPException(status_code=500, detail="Failed to load sample after create")

    response_payload = row_payload_with_blob_metadata(
        created_row,
        blob_key="sample_blob",
        blob_prefix="sample",
        include_blob=False,
    )
    sample_response = SampleResponse.model_validate(response_payload)
    logger.info(
        "Created sample metadata row in v2 samples endpoint (sample_id=%s, sample_name=%s)",
        sample_id,
        sample_name,
    )
    return ApiResponse[SampleResponse](
        message="Sample created successfully.",
        data=sample_response,
    )


@router.put("/api/v2/samples/{sample_id}/blob", response_model=ApiResponse[SampleBlobUploadResponse])
async def upload_sample_blob(
    sample_id: str = FastAPIPath(..., min_length=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
) -> ApiResponse[SampleBlobUploadResponse]:
    samples_repository = SamplesRepository(engine)
    sample_row = samples_repository.fetch_sample(sample_id)
    if sample_row is None:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample_blob = await file.read()
    if not sample_blob:
        raise HTTPException(status_code=400, detail="Sample file is empty")

    updated = samples_repository.update_sample_blob(
        sample_id=sample_id,
        sample_blob=sample_blob,
        sample_mime_type=file.content_type,
    )
    if updated != 1:
        raise HTTPException(status_code=409, detail=f"Failed to update sample blob: {sample_id}")

    logger.info("Updated sample blob in v2 samples endpoint (sample_id=%s)", sample_id)
    return ApiResponse[SampleBlobUploadResponse](
        message="Sample blob uploaded successfully.",
        data=SampleBlobUploadResponse(sample_id=sample_id),
    )


@router.delete("/api/v2/samples/{sample_id}", response_model=ApiDeleteResponse)
def delete_sample(
    sample_id: str = FastAPIPath(..., min_length=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    samples_repository = SamplesRepository(engine)
    row = samples_repository.fetch_sample(sample_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sample not found")

    deleted = samples_repository.delete_sample(sample_id)
    if deleted != 1:
        raise HTTPException(status_code=409, detail=f"Failed to delete sample: {sample_id}")

    logger.info("Deleted sample record from v2 samples endpoint (sample_id=%s)", sample_id)
    return ApiDeleteResponse(message="Sample deleted successfully.")


@router.delete("/api/v2/samples", response_model=ApiDeleteResponse)
def delete_samples(
    payload: SampleDeleteRequest = Body(...),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    sample_ids = [sample_id.strip() for sample_id in payload.sample_ids if sample_id.strip()]
    if not sample_ids:
        raise HTTPException(status_code=400, detail="sample_ids is required")

    samples_repository = SamplesRepository(engine)
    unique_sample_ids = list(dict.fromkeys(sample_ids))
    missing_sample_ids = [
        sample_id for sample_id in unique_sample_ids if samples_repository.fetch_sample(sample_id) is None
    ]
    if missing_sample_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
        )

    deleted_count = 0
    for sample_id in unique_sample_ids:
        deleted_count += samples_repository.delete_sample(sample_id)

    if deleted_count != len(unique_sample_ids):
        raise HTTPException(status_code=409, detail="Failed to delete all requested samples")

    logger.info("Deleted sample records from v2 samples endpoint (sample_count=%s)", deleted_count)
    return ApiDeleteResponse(message="Samples deleted successfully.")
