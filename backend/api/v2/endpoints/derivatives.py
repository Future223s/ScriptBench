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
from backend.database.repositories.derivative_groups_repository import (
    DerivativeGroupsRepository,
)
from backend.database.repositories.samples_repository import SamplesRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.derivatives import (
    DerivativeCreateRequest,
    DerivativeCreateResponse,
    DerivativeDeleteRequest,
    DerivativeMapRequest,
    DerivativeMapResponse,
    DerivativeMapApiResponse,
    DerivativeMapResult,
    DerivativeResponse,
    DerivativePatchRequest,
    DerivativePatchResponse,
    DerivativeUploadBlobResponse,
    DerivativeSummaryResponse,
)

router = APIRouter(tags=["derivatives-v2"])
logger = logging.getLogger(__name__)


def _derivative_detail_payload(row: dict[str, object]) -> dict[str, object]:
    payload = row_to_dict(row, exclude={"blob"})
    blob = row.get("blob")
    payload["has_blob"] = blob is not None
    payload["blob_size"] = (
        len(blob) if blob is not None else 0
    )
    payload["blob_base64"] = (
        base64.b64encode(blob).decode("ascii")
        if blob is not None
        else None
    )
    return payload


@router.get(
    "/api/v2/derivatives", response_model=ApiListResponse[DerivativeSummaryResponse]
)
def list_derivatives(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[DerivativeSummaryResponse]:
    derivatives_repository = DerivativesRepository(engine)
    derivative_rows = derivatives_repository.list_derivatives(query=query, limit=limit)
    items = [DerivativeSummaryResponse.model_validate(row) for row in derivative_rows]
    logger.info(
        "Listed derivative records from v2 derivatives endpoint (derivative_count=%s, query=%s, limit=%s)",
        len(items),
        query,
        limit,
    )
    return ApiListResponse[DerivativeSummaryResponse](
        message="Derivatives retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get(
    "/api/v2/derivatives/{id}", response_model=ApiResponse[DerivativeResponse]
)
def get_derivative(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[DerivativeResponse]:
    derivatives_repository = DerivativesRepository(engine)
    row = derivatives_repository.fetch_derivative(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative not found")

    derivative_response = DerivativeResponse.model_validate(_derivative_detail_payload(row))
    logger.info(
        "Loaded derivative record from v2 derivatives endpoint (id=%s)",
        id,
    )
    return ApiResponse[DerivativeResponse](
        message="Derivative retrieved successfully.",
        data=derivative_response,
    )


@router.post("/api/v2/derivatives/map", response_model=DerivativeMapApiResponse)
def map_derivatives(
    payload: DerivativeMapRequest,
    engine=Depends(get_engine),
) -> DerivativeMapApiResponse:
    derivatives_repository = DerivativesRepository(engine)
    membership_rows = derivatives_repository.fetch_membership_mappings()
    sample_mapping_rows = derivatives_repository.fetch_sample_mappings()
    sample_rows = derivatives_repository.fetch_samples()

    if not membership_rows or not sample_mapping_rows:
        message = (
            "No derivative groups are configured."
            if not membership_rows
            else "No sample mappings are configured."
        )
        rejected_derivatives = [
            {
                "id": item.id,
                "name": item.name,
                "reason": message,
            }
            for item in payload.derivatives
        ]
        return DerivativeMapApiResponse(
            message=message,
            data=DerivativeMapResponse(
                mapped_derivatives=[],
                rejected_derivatives=rejected_derivatives,
                mapped_count=0,
                rejected_count=len(rejected_derivatives),
            ),
        )

    rules_by_group: dict[int, dict[str, list[dict[str, object]]]] = {}
    for row in membership_rows:
        group_rules = rules_by_group.setdefault(
            int(row["derivative_group_id"]), {"membership": [], "sample": []}
        )
        group_rules["membership"].append(row)

    for row in sample_mapping_rows:
        group_rules = rules_by_group.setdefault(
            int(row["derivative_group_id"]), {"membership": [], "sample": []}
        )
        group_rules["sample"].append(row)

    for group in DerivativeGroupsRepository(engine).list_mapping_rules():
        group_rules = rules_by_group.setdefault(
            int(group["id"]), {"membership": [], "sample": []}
        )
        position_rule = group.get("position_rule") or {}
        membership_conditions = position_rule.get("membership_conditions")
        sample_conditions = position_rule.get("sample_mapping_conditions")
        if isinstance(membership_conditions, list):
            group_rules["membership_conditions"] = membership_conditions
        if isinstance(sample_conditions, list):
            group_rules["sample_conditions"] = sample_conditions

    mapped_derivatives: list[DerivativeMapResult] = []
    rejected_derivatives: list[dict[str, object]] = []

    for item in payload.derivatives:
        source_row = derivatives_repository.fetch_derivative(item.id)
        if source_row is None:
            rejected_derivatives.append(
                {
                    "id": item.id,
                    "name": item.name,
                    "reason": "derivative not found",
                }
            )
            continue

        name = str(source_row.get("name") or "").strip()
        matched_group_ids: list[int] = []

        for derivative_group_id, group_rules in rules_by_group.items():
            conditions = group_rules.get("membership_conditions")
            if conditions and all(
                _matches_text(
                    str(source_row.get(str(rule.get("field") or "name")) or "").strip(),
                    str(rule.get("value") or ""),
                    str(rule.get("operator") or "contains"),
                    False,
                )
                for rule in conditions
            ):
                matched_group_ids.append(derivative_group_id)
                continue
            for rule in group_rules["membership"]:
                derivative_field = str(rule.get("derivative_field") or "name")
                derivative_value = str(source_row.get(derivative_field) or "").strip()
                if _matches_text(
                    derivative_value,
                    str(rule.get("pattern") or ""),
                    str(rule.get("operator") or "contains"),
                    bool(rule.get("case_sensitive")),
                ):
                    matched_group_ids.append(derivative_group_id)
                    break

        if len(matched_group_ids) != 1:
            rejected_derivatives.append(
                {
                    "id": item.id,
                    "name": name,
                    "reason": "derivative matched zero or multiple membership mappings",
                }
            )
            continue

        derivative_group_id = matched_group_ids[0]
        sample_matches: list[dict[str, object]] = []

        for sample_row in sample_rows:
            conditions = rules_by_group[derivative_group_id].get("sample_conditions")
            if conditions and all(
                _matches_text(
                    str(source_row.get(str(rule.get("field") or "name")) or "").strip(),
                    str(sample_row.get(str(rule.get("value") or "name")) or "").strip(),
                    str(rule.get("operator") or "contains"),
                    False,
                )
                for rule in conditions
            ):
                sample_matches.append(sample_row)
                continue
            for rule in rules_by_group[derivative_group_id]["sample"]:
                derivative_field = str(rule.get("derivative_field") or "name")
                sample_field = str(rule.get("sample_field") or "name")
                derivative_value = str(source_row.get(derivative_field) or "").strip()
                sample_value = str(sample_row.get(sample_field) or "").strip()
                if _matches_text(
                    derivative_value,
                    sample_value,
                    str(rule.get("operator") or "contains"),
                    bool(rule.get("case_sensitive")),
                ):
                    sample_matches.append(sample_row)
                    break

        if len(sample_matches) != 1:
            rejected_derivatives.append(
                {
                    "id": item.id,
                    "name": name,
                    "reason": "derivative matched zero or multiple samples",
                }
            )
            continue

        sample_row = sample_matches[0]
        mapped_derivatives.append(
            DerivativeMapResult(
                id=item.id,
                name=name,
                sample_id=str(sample_row["id"]),
                derivative_group_id=derivative_group_id,
                category=str(
                    source_row.get("category") or "companion"
                ),
                mime_type=str(source_row.get("mime_type") or ""),
                created_at=source_row.get("created_at"),
                updated_at=source_row.get("updated_at"),
            )
        )

    response = DerivativeMapResponse(
        mapped_derivatives=mapped_derivatives,
        rejected_derivatives=rejected_derivatives,
        mapped_count=len(mapped_derivatives),
        rejected_count=len(rejected_derivatives),
    )
    logger.info(
        "Mapped derivative records in v2 derivatives endpoint (mapped_count=%s, rejected_count=%s)",
        response.mapped_count,
        response.rejected_count,
    )
    return DerivativeMapApiResponse(
        message="Derivatives mapped successfully.", data=response
    )


@router.post("/api/v2/derivatives", response_model=DerivativeCreateResponse)
def create_derivatives(
    payload: DerivativeCreateRequest,
    engine=Depends(get_engine),
) -> DerivativeCreateResponse:
    derivatives_repository = DerivativesRepository(engine)
    created_rows: list[DerivativeResponse] = []

    for item in payload.derivatives:
        if not item.name.strip():
            raise HTTPException(status_code=400, detail="name is required")
        if not item.mime_type:
            raise HTTPException(
                status_code=400, detail="mime_type is required"
            )
        derivative_row = {
            "name": item.name.strip(),
            "sample_id": None,
            "derivative_group_id": None,
            "category": "companion",
            "blob": b"",
            "mime_type": item.mime_type,
        }

        id = derivatives_repository.insert_derivative(derivative_row)

        row = derivatives_repository.fetch_derivative(id)
        if row is None:
            raise HTTPException(
                status_code=500, detail="Failed to load derivative after create"
            )
        created_rows.append(
            DerivativeResponse.model_validate(_derivative_detail_payload(row))
        )

    logger.info(
        "Created or updated derivative records in v2 derivatives endpoint (derivative_count=%s)",
        len(created_rows),
    )
    return DerivativeCreateResponse(
        message="Derivatives persisted successfully.",
        data=created_rows,
    )


@router.put(
    "/api/v2/derivatives/{id}/blob", response_model=DerivativeUploadBlobResponse
)
async def upload_blob(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
) -> DerivativeUploadBlobResponse:
    derivatives_repository = DerivativesRepository(engine)
    row = derivatives_repository.fetch_derivative(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative not found")

    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="Derivative file is empty")

    updated = derivatives_repository.update_blob(
        id=id,
        blob=blob,
        mime_type=file.content_type,
    )
    if updated != 1:
        raise HTTPException(
            status_code=409, detail=f"Failed to update derivative blob: {id}"
        )

    logger.info(
        "Updated derivative blob in v2 derivatives endpoint (id=%s)", id
    )
    return DerivativeUploadBlobResponse(
        message="Derivative blob uploaded successfully.",
        data=[
            DerivativeResponse.model_validate(
                _derivative_detail_payload(
                    derivatives_repository.fetch_derivative(id) or {}
                )
            )
        ],
    )


@router.patch("/api/v2/derivatives", response_model=DerivativePatchResponse)
def patch_derivatives(
    payload: DerivativePatchRequest,
    engine=Depends(get_engine),
) -> DerivativePatchResponse:
    derivatives_repository = DerivativesRepository(engine)
    derivative_groups_repository = DerivativeGroupsRepository(engine)
    samples_repository = SamplesRepository(engine)
    updated_rows: list[DerivativeResponse] = []

    for item in payload.derivatives:
        existing = derivatives_repository.fetch_derivative(item.id)
        if existing is None:
            raise HTTPException(
                status_code=404, detail=f"Derivative not found: {item.id}"
            )

        update_row: dict[str, object] = {}
        if "derivative_group_id" in item.model_fields_set:
            if item.derivative_group_id is not None:
                derivative_group_row = derivative_groups_repository.fetch_derivative_group(
                    item.derivative_group_id
                )
                if derivative_group_row is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Derivative group not found: {item.derivative_group_id}",
                    )
                update_row["derivative_group_id"] = item.derivative_group_id
            else:
                update_row["derivative_group_id"] = None
        if "sample_id" in item.model_fields_set:
            sample_id = (
                item.sample_id.strip()
                if item.sample_id
                else None
            )
            if (
                sample_id is not None
                and samples_repository.fetch_sample(sample_id) is None
            ):
                sample_id = None
            update_row["sample_id"] = sample_id

        if update_row:
            updated = derivatives_repository.update_derivative(item.id, update_row)
            if updated != 1:
                raise HTTPException(
                    status_code=409,
                    detail=f"Failed to update derivative: {item.id}",
                )

        row = derivatives_repository.fetch_derivative(item.id)
        if row is None:
            raise HTTPException(
                status_code=500, detail="Failed to load derivative after patch"
            )
        updated_rows.append(
            DerivativeResponse.model_validate(_derivative_detail_payload(row))
        )

    logger.info(
        "Patched derivative records in v2 derivatives endpoint (derivative_count=%s)",
        len(updated_rows),
    )
    return DerivativePatchResponse(
        message="Derivatives updated successfully.",
        data=updated_rows,
    )


@router.delete("/api/v2/derivatives/{id}", status_code=204)
def delete_derivative(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> Response:
    derivatives_repository = DerivativesRepository(engine)
    row = derivatives_repository.fetch_derivative(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative not found")

    deleted = derivatives_repository.delete_derivative(id)
    if deleted != 1:
        raise HTTPException(
            status_code=409, detail=f"Failed to delete derivative: {id}"
        )

    logger.info(
        "Deleted derivative record from v2 derivatives endpoint (id=%s)",
        id,
    )
    return Response(status_code=204)


@router.delete("/api/v2/derivatives", status_code=204)
def delete_derivatives(
    payload: DerivativeDeleteRequest = Body(...),
    engine=Depends(get_engine),
) -> Response:
    ids = [int(id) for id in payload.ids]
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")

    derivatives_repository = DerivativesRepository(engine)
    unique_ids = list(dict.fromkeys(ids))
    missing_ids = [
        id
        for id in unique_ids
        if derivatives_repository.fetch_derivative(id) is None
    ]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown id(s): {', '.join(map(str, missing_ids))}",
        )

    deleted_count = derivatives_repository.delete_derivatives(unique_ids)
    if deleted_count != len(unique_ids):
        raise HTTPException(
            status_code=409, detail="Failed to delete all requested derivatives"
        )

    logger.info(
        "Deleted derivative records from v2 derivatives endpoint (derivative_count=%s)",
        deleted_count,
    )
    return Response(status_code=204)


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
