from __future__ import annotations

import base64
import logging

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Path as FastAPIPath,
    Query,
    Response,
    UploadFile,
)

from backend.api.dependencies import get_engine, row_to_dict
from backend.database.repositories.derivatives_repository import DerivativesRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.derivatives import (
    DerivativeCreateRequest,
    DerivativeCreateResponse,
    DerivativeDeleteRequest,
    DerivativeResponse,
    DerivativeSummaryResponse,
    DerivativeUploadBlobResponse,
)
from backend.services.file_naming import file_stem, matching_sample_ids


router = APIRouter(tags=["derivatives-v2"])
logger = logging.getLogger(__name__)


def _derivative_detail_payload(row: dict[str, object]) -> dict[str, object]:
    payload = row_to_dict(row, exclude={"blob"})
    blob = row.get("blob")
    payload["has_blob"] = blob is not None
    payload["blob_size"] = len(blob) if blob is not None else 0
    payload["blob_base64"] = (
        base64.b64encode(blob).decode("ascii") if blob is not None else None
    )
    return payload


@router.get(
    "/api/v2/derivatives",
    response_model=ApiListResponse[DerivativeSummaryResponse],
)
def list_derivatives(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[DerivativeSummaryResponse]:
    repository = DerivativesRepository(engine)
    rows = repository.list_derivatives(query=query, limit=limit)
    items = [DerivativeSummaryResponse.model_validate(row) for row in rows]
    return ApiListResponse[DerivativeSummaryResponse](
        message="Derivatives retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get(
    "/api/v2/derivatives/{id}",
    response_model=ApiResponse[DerivativeResponse],
)
def get_derivative(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[DerivativeResponse]:
    row = DerivativesRepository(engine).fetch_derivative(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative not found")
    return ApiResponse[DerivativeResponse](
        message="Derivative retrieved successfully.",
        data=DerivativeResponse.model_validate(_derivative_detail_payload(row)),
    )


@router.post("/api/v2/derivatives", response_model=DerivativeCreateResponse)
def create_derivatives(
    payload: DerivativeCreateRequest,
    engine=Depends(get_engine),
) -> DerivativeCreateResponse:
    repository = DerivativesRepository(engine)
    samples = repository.fetch_samples()
    rows: list[dict[str, object]] = []

    for item in payload.derivatives:
        name = file_stem(item.name)
        if not name:
            raise HTTPException(status_code=400, detail="name is required")
        if not item.mime_type:
            raise HTTPException(status_code=400, detail="mime_type is required")

        sample_ids = matching_sample_ids(name, samples)
        if len(sample_ids) != 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Derivative {name} must start with exactly one canonical "
                    "sample name followed by an underscore"
                ),
            )
        memberships = repository.fetch_membership_mapping_candidates(name)
        if len(memberships) != 1:
            raise HTTPException(
                status_code=400,
                detail=f"Derivative {name} matched {len(memberships)} membership rules; expected 1",
            )
        rows.append(
            {
                "name": name,
                "sample_id": sample_ids[0],
                "derivative_group_id": int(memberships[0]["derivative_group_id"]),
                "category": "decomposition",
                "blob": b"",
                "mime_type": item.mime_type,
            }
        )

    inserted_ids = repository.insert_derivatives(rows)
    created_rows = []
    for derivative_id in inserted_ids:
        row = repository.fetch_derivative(derivative_id)
        if row is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to load derivative after create",
            )
        created_rows.append(
            DerivativeResponse.model_validate(_derivative_detail_payload(row))
        )
    return DerivativeCreateResponse(
        message="Derivatives automatically mapped and persisted.",
        data=created_rows,
    )


@router.put(
    "/api/v2/derivatives/{id}/blob",
    response_model=DerivativeUploadBlobResponse,
)
async def upload_blob(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
) -> DerivativeUploadBlobResponse:
    repository = DerivativesRepository(engine)
    if repository.fetch_derivative(id) is None:
        raise HTTPException(status_code=404, detail="Derivative not found")
    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="Derivative file is empty")
    if repository.update_blob(id=id, blob=blob, mime_type=file.content_type) != 1:
        raise HTTPException(status_code=409, detail=f"Failed to update derivative blob: {id}")
    row = repository.fetch_derivative(id)
    return DerivativeUploadBlobResponse(
        message="Derivative blob uploaded successfully.",
        data=[DerivativeResponse.model_validate(_derivative_detail_payload(row or {}))],
    )


@router.delete("/api/v2/derivatives/{id}", status_code=204)
def delete_derivative(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> Response:
    repository = DerivativesRepository(engine)
    if repository.fetch_derivative(id) is None:
        raise HTTPException(status_code=404, detail="Derivative not found")
    if repository.delete_derivative(id) != 1:
        raise HTTPException(status_code=409, detail=f"Failed to delete derivative: {id}")
    return Response(status_code=204)


@router.delete("/api/v2/derivatives", status_code=204)
def delete_derivatives(
    payload: DerivativeDeleteRequest = Body(...),
    engine=Depends(get_engine),
) -> Response:
    ids = list(dict.fromkeys(int(id) for id in payload.ids))
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")
    repository = DerivativesRepository(engine)
    missing_ids = [id for id in ids if repository.fetch_derivative(id) is None]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown id(s): {', '.join(map(str, missing_ids))}",
        )
    if repository.delete_derivatives(ids) != len(ids):
        raise HTTPException(status_code=409, detail="Failed to delete all requested derivatives")
    return Response(status_code=204)
