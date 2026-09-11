from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path as FastAPIPath, Query

from backend.api.dependencies import get_engine
from backend.database.repositories.derivative_groups_repository import (
    DerivativeGroupsRepository,
)
from backend.database.repositories.derivatives_repository import DerivativesRepository
from backend.database.repositories.membership_mapping_repository import (
    MembershipMappingRepository,
)
from backend.database.repositories.sample_mapping_repository import (
    SampleMappingRepository,
)
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.derivative_groups import (
    DerivativeGroupCreateRequest,
    DerivativeGroupDeleteRequest,
    DerivativeGroupResponse,
    DerivativeGroupSummaryResponse,
)

router = APIRouter(tags=["derivative-groups-v2"])
logger = logging.getLogger(__name__)


@router.get(
    "/api/v2/derivative-groups",
    response_model=ApiListResponse[DerivativeGroupSummaryResponse],
)
def list_derivative_groups(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    mapping_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[DerivativeGroupSummaryResponse]:
    derivative_groups_repository = DerivativeGroupsRepository(engine)
    rows = derivative_groups_repository.list_derivative_groups(
        query=query,
        mapping_type=mapping_type,
        status=status,
        limit=limit,
    )
    items = [DerivativeGroupSummaryResponse.model_validate(row) for row in rows]
    logger.info(
        "Listed derivative group records from v2 derivative groups endpoint (derivative_group_count=%s, query=%s, mapping_type=%s, status=%s, limit=%s)",
        len(items),
        query,
        mapping_type,
        status,
        limit,
    )
    return ApiListResponse[DerivativeGroupSummaryResponse](
        message="Derivative groups retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get(
    "/api/v2/derivative-groups/{id}",
    response_model=ApiResponse[DerivativeGroupResponse],
)
def get_derivative_group(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[DerivativeGroupResponse]:
    derivative_groups_repository = DerivativeGroupsRepository(engine)
    row = derivative_groups_repository.fetch_derivative_group(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative group not found")

    derivative_group_response = DerivativeGroupResponse.model_validate(row)
    logger.info(
        "Loaded derivative group record from v2 derivative groups endpoint (id=%s)",
        id,
    )
    return ApiResponse[DerivativeGroupResponse](
        message="Derivative group retrieved successfully.",
        data=derivative_group_response,
    )


@router.post(
    "/api/v2/derivative-groups", response_model=ApiResponse[DerivativeGroupResponse]
)
def create_derivative_group(
    payload: DerivativeGroupCreateRequest,
    engine=Depends(get_engine),
) -> ApiResponse[DerivativeGroupResponse]:
    derivative_groups_repository = DerivativeGroupsRepository(engine)

    name = payload.name.strip()
    description = (
        payload.description.strip()
        if payload.description is not None
        else None
    )
    mapping_type = payload.mapping_type.strip()
    ids = list(dict.fromkeys(payload.derivative_ids))
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if not mapping_type:
        raise HTTPException(status_code=400, detail="mapping_type is required")

    if derivative_groups_repository.fetch_derivative_groups_by_names([name]):
        raise HTTPException(
            status_code=409,
            detail=f"Derivative group already exists: {name}",
        )

    derivatives_repository = DerivativesRepository(engine)
    missing_ids = [
        id
        for id in ids
        if derivatives_repository.fetch_derivative(id) is None
    ]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown id(s): {', '.join(map(str, missing_ids))}",
        )

    if ids:
        with engine.begin() as conn:
            id = derivative_groups_repository.insert(
                {
                    "name": name,
                    "description": description or None,
                    "position_rule": None,
                    "mapping_type": mapping_type,
                    "status": "draft",
                },
                conn=conn,
            )
            for derivative_id in ids:
                updated = derivatives_repository.update_derivative(
                    derivative_id,
                    {"derivative_group_id": id},
                    conn=conn,
                )
                if updated != 1:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Failed to assign derivative to group: {derivative_id}",
                    )
    else:
        position_rule = payload.position_rule or {}
        membership_row = {
            "derivative_field": str(
                position_rule.get("membership_derivative_field") or "name"
            ),
            "operator": str(
                position_rule.get("membership_operator") or "contains"
            ),
            "pattern": str(position_rule.get("membership_pattern") or "").strip(),
            "case_sensitive": bool(
                position_rule.get("membership_case_sensitive", False)
            ),
        }
        sample_row = {
            "derivative_field": str(
                position_rule.get("sample_mapping_derivative_field")
                or "name"
            ),
            "sample_field": str(
                position_rule.get("sample_mapping_sample_field") or "name"
            ),
            "operator": str(
                position_rule.get("sample_mapping_operator") or "contains"
            ),
            "case_sensitive": bool(
                position_rule.get("sample_mapping_case_sensitive", False)
            ),
        }
        derivative_fields = {"id", "name", "sample_id", "derivative_group_id", "category", "mime_type"}
        sample_fields = {"id", "name", "mime_type", "ground_truth_text"}
        if (membership_row["derivative_field"] not in derivative_fields
                or sample_row["derivative_field"] not in derivative_fields
                or sample_row["sample_field"] not in sample_fields):
            raise HTTPException(status_code=400, detail="Unsupported mapping field")

        if not membership_row["pattern"]:
            raise HTTPException(
                status_code=400, detail="position_rule.membership_pattern is required"
            )

        membership_mapping_repository = MembershipMappingRepository(engine)
        sample_mapping_repository = SampleMappingRepository(engine)

        with engine.begin() as conn:
            id = derivative_groups_repository.insert(
                {
                    "name": name,
                    "description": description or None,
                    "position_rule": position_rule,
                    "mapping_type": mapping_type,
                    "status": "draft",
                },
                conn=conn,
            )
            membership_row["derivative_group_id"] = id
            sample_row["derivative_group_id"] = id
            membership_mapping_repository.insert(membership_row, conn=conn)
            sample_mapping_repository.insert(sample_row, conn=conn)

    row = derivative_groups_repository.fetch_derivative_group(id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load derivative group after create"
        )

    derivative_group_response = DerivativeGroupResponse.model_validate(row)
    logger.info(
        "Created derivative group record in v2 derivative groups endpoint (id=%s, name=%s)",
        id,
        name,
    )
    return ApiResponse[DerivativeGroupResponse](
        message="Derivative group created successfully.",
        data=derivative_group_response,
    )


@router.delete(
    "/api/v2/derivative-groups/{id}", response_model=ApiDeleteResponse
)
def delete_derivative_group(
    id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    derivative_groups_repository = DerivativeGroupsRepository(engine)
    membership_mapping_repository = MembershipMappingRepository(engine)
    sample_mapping_repository = SampleMappingRepository(engine)
    row = derivative_groups_repository.fetch_derivative_group(id)
    if row is None:
        raise HTTPException(status_code=404, detail="Derivative group not found")

    with engine.begin() as conn:
        membership_deleted = membership_mapping_repository.delete_by_derivative_group_ids(
            [id], conn=conn
        )
        sample_deleted = sample_mapping_repository.delete_by_derivative_group_ids(
            [id], conn=conn
        )
        deleted = derivative_groups_repository.delete_derivative_group(
            id, conn=conn
        )
        if deleted != 1:
            raise HTTPException(
                status_code=409,
                detail=f"Failed to delete derivative group: {id}",
            )

    logger.info(
        "Deleted derivative group record from v2 derivative groups endpoint (id=%s, membership_deleted=%s, sample_deleted=%s)",
        id,
        membership_deleted,
        sample_deleted,
    )
    return ApiDeleteResponse(message="Derivative group deleted successfully.")


@router.delete("/api/v2/derivative-groups", response_model=ApiDeleteResponse)
def delete_derivative_groups(
    payload: DerivativeGroupDeleteRequest,
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    ids = [
        int(id) for id in payload.ids
    ]
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")

    derivative_groups_repository = DerivativeGroupsRepository(engine)
    membership_mapping_repository = MembershipMappingRepository(engine)
    sample_mapping_repository = SampleMappingRepository(engine)
    unique_ids = list(dict.fromkeys(ids))
    missing_ids = [
        id
        for id in unique_ids
        if derivative_groups_repository.fetch_derivative_group(id) is None
    ]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown id(s): {', '.join(map(str, missing_ids))}",
        )

    with engine.begin() as conn:
        membership_mapping_repository.delete_by_derivative_group_ids(
            unique_ids, conn=conn
        )
        sample_mapping_repository.delete_by_derivative_group_ids(unique_ids, conn=conn)
        deleted_count = derivative_groups_repository.delete_derivative_groups(
            unique_ids, conn=conn
        )
    if deleted_count != len(unique_ids):
        raise HTTPException(
            status_code=409, detail="Failed to delete all requested derivative groups"
        )

    logger.info(
        "Deleted derivative group records from v2 derivative groups endpoint (derivative_group_count=%s)",
        deleted_count,
    )
    return ApiDeleteResponse(message="Derivative groups deleted successfully.")
