from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path as FastAPIPath, Query

from backend.api.dependencies import get_engine
from backend.database.repositories.artifact_groups_repository import ArtifactGroupsRepository
from backend.database.repositories.membership_mapping_repository import MembershipMappingRepository
from backend.database.repositories.sample_mapping_repository import SampleMappingRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.artifact_groups import (
    ArtifactGroupCreateRequest,
    ArtifactGroupDeleteRequest,
    ArtifactGroupResponse,
    ArtifactGroupSummaryResponse,
)

router = APIRouter(tags=["artifact-groups-v2"])
logger = logging.getLogger(__name__)


@router.get("/api/v2/artifact-groups", response_model=ApiListResponse[ArtifactGroupSummaryResponse])
def list_artifact_groups(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    mapping_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[ArtifactGroupSummaryResponse]:
    artifact_groups_repository = ArtifactGroupsRepository(engine)
    rows = artifact_groups_repository.list_artifact_groups(
        query=query,
        mapping_type=mapping_type,
        status=status,
        limit=limit,
    )
    items = [ArtifactGroupSummaryResponse.model_validate(row) for row in rows]
    logger.info(
        "Listed artifact group records from v2 artifact groups endpoint (artifact_group_count=%s, query=%s, mapping_type=%s, status=%s, limit=%s)",
        len(items),
        query,
        mapping_type,
        status,
        limit,
    )
    return ApiListResponse[ArtifactGroupSummaryResponse](
        message="Artifact groups retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get("/api/v2/artifact-groups/{artifact_group_id}", response_model=ApiResponse[ArtifactGroupResponse])
def get_artifact_group(
    artifact_group_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[ArtifactGroupResponse]:
    artifact_groups_repository = ArtifactGroupsRepository(engine)
    row = artifact_groups_repository.fetch_artifact_group(artifact_group_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact group not found")

    artifact_group_response = ArtifactGroupResponse.model_validate(row)
    logger.info(
        "Loaded artifact group record from v2 artifact groups endpoint (artifact_group_id=%s)",
        artifact_group_id,
    )
    return ApiResponse[ArtifactGroupResponse](
        message="Artifact group retrieved successfully.",
        data=artifact_group_response,
    )


@router.post("/api/v2/artifact-groups", response_model=ApiResponse[ArtifactGroupResponse])
def create_artifact_group(
    payload: ArtifactGroupCreateRequest,
    engine=Depends(get_engine),
) -> ApiResponse[ArtifactGroupResponse]:
    artifact_groups_repository = ArtifactGroupsRepository(engine)

    artifact_group_name = payload.artifact_group_name.strip()
    artifact_group_description = (
        payload.artifact_group_description.strip()
        if payload.artifact_group_description is not None
        else None
    )
    mapping_type = payload.mapping_type.strip()
    if not artifact_group_name:
        raise HTTPException(status_code=400, detail="artifact_group_name is required")
    if not mapping_type:
        raise HTTPException(status_code=400, detail="mapping_type is required")

    if artifact_groups_repository.fetch_artifact_groups_by_names([artifact_group_name]):
        raise HTTPException(
            status_code=409,
            detail=f"Artifact group already exists: {artifact_group_name}",
        )

    position_rule = payload.position_rule or {}
    membership_row = {
        "artifact_group_id": None,
        "artifact_field": str(position_rule.get("membership_artifact_field") or "artifact_name"),
        "operator": str(position_rule.get("membership_operator") or "contains"),
        "pattern": str(position_rule.get("membership_pattern") or "").strip(),
        "case_sensitive": bool(position_rule.get("membership_case_sensitive", False)),
    }
    sample_row = {
        "artifact_group_id": None,
        "artifact_field": str(position_rule.get("sample_mapping_artifact_field") or "artifact_name"),
        "sample_field": str(position_rule.get("sample_mapping_sample_field") or "sample_name"),
        "operator": str(position_rule.get("sample_mapping_operator") or "contains"),
        "case_sensitive": bool(position_rule.get("sample_mapping_case_sensitive", False)),
    }
    if not membership_row["pattern"]:
        raise HTTPException(status_code=400, detail="position_rule.membership_pattern is required")

    membership_mapping_repository = MembershipMappingRepository(engine)
    sample_mapping_repository = SampleMappingRepository(engine)

    with engine.begin() as conn:
        artifact_group_id = artifact_groups_repository.insert(
            {
                "artifact_group_name": artifact_group_name,
                "artifact_group_description": artifact_group_description or None,
                "membership_mapping_id": None,
                "sample_mapping_id": None,
                "position_rule": position_rule,
                "mapping_type": mapping_type,
                "status": "draft",
            },
            conn=conn,
        )
        membership_row["artifact_group_id"] = artifact_group_id
        sample_row["artifact_group_id"] = artifact_group_id
        membership_mapping_id = membership_mapping_repository.insert(membership_row, conn=conn)
        sample_mapping_id = sample_mapping_repository.insert(sample_row, conn=conn)
        updated_count = artifact_groups_repository.update(
            artifact_group_id,
            {
                "membership_mapping_id": membership_mapping_id,
                "sample_mapping_id": sample_mapping_id,
            },
            conn=conn,
        )
        if updated_count != 1:
            raise HTTPException(status_code=409, detail=f"Failed to link mappings for artifact group: {artifact_group_id}")

    row = artifact_groups_repository.fetch_artifact_group(artifact_group_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load artifact group after create")

    artifact_group_response = ArtifactGroupResponse.model_validate(row)
    logger.info(
        "Created artifact group record in v2 artifact groups endpoint (artifact_group_id=%s, artifact_group_name=%s)",
        artifact_group_id,
        artifact_group_name,
    )
    return ApiResponse[ArtifactGroupResponse](
        message="Artifact group created successfully.",
        data=artifact_group_response,
    )


@router.delete("/api/v2/artifact-groups/{artifact_group_id}", response_model=ApiDeleteResponse)
def delete_artifact_group(
    artifact_group_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    artifact_groups_repository = ArtifactGroupsRepository(engine)
    membership_mapping_repository = MembershipMappingRepository(engine)
    sample_mapping_repository = SampleMappingRepository(engine)
    row = artifact_groups_repository.fetch_artifact_group(artifact_group_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact group not found")

    with engine.begin() as conn:
        membership_deleted = membership_mapping_repository.delete_by_artifact_group_ids([artifact_group_id], conn=conn)
        sample_deleted = sample_mapping_repository.delete_by_artifact_group_ids([artifact_group_id], conn=conn)
        deleted = artifact_groups_repository.delete_artifact_group(artifact_group_id, conn=conn)
        if deleted != 1:
            raise HTTPException(status_code=409, detail=f"Failed to delete artifact group: {artifact_group_id}")

    logger.info(
        "Deleted artifact group record from v2 artifact groups endpoint (artifact_group_id=%s, membership_deleted=%s, sample_deleted=%s)",
        artifact_group_id,
        membership_deleted,
        sample_deleted,
    )
    return ApiDeleteResponse(message="Artifact group deleted successfully.")


@router.delete("/api/v2/artifact-groups", response_model=ApiDeleteResponse)
def delete_artifact_groups(
    payload: ArtifactGroupDeleteRequest,
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    artifact_group_ids = [int(artifact_group_id) for artifact_group_id in payload.artifact_group_ids]
    if not artifact_group_ids:
        raise HTTPException(status_code=400, detail="artifact_group_ids is required")

    artifact_groups_repository = ArtifactGroupsRepository(engine)
    membership_mapping_repository = MembershipMappingRepository(engine)
    sample_mapping_repository = SampleMappingRepository(engine)
    unique_ids = list(dict.fromkeys(artifact_group_ids))
    missing_ids = [artifact_group_id for artifact_group_id in unique_ids if artifact_groups_repository.fetch_artifact_group(artifact_group_id) is None]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Unknown artifact_group_id(s): {', '.join(map(str, missing_ids))}")

    with engine.begin() as conn:
        membership_mapping_repository.delete_by_artifact_group_ids(unique_ids, conn=conn)
        sample_mapping_repository.delete_by_artifact_group_ids(unique_ids, conn=conn)
        deleted_count = artifact_groups_repository.delete_artifact_groups(unique_ids, conn=conn)
    if deleted_count != len(unique_ids):
        raise HTTPException(status_code=409, detail="Failed to delete all requested artifact groups")

    logger.info("Deleted artifact group records from v2 artifact groups endpoint (artifact_group_count=%s)", deleted_count)
    return ApiDeleteResponse(message="Artifact groups deleted successfully.")
