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
from backend.database.repositories.artifacts_repository import ArtifactsRepository
from backend.database.repositories.artifact_groups_repository import (
    ArtifactGroupsRepository,
)
from backend.database.repositories.samples_repository import SamplesRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.artifacts import (
    ArtifactCreateRequest,
    ArtifactCreateResponse,
    ArtifactDeleteRequest,
    ArtifactMapRequest,
    ArtifactMapResponse,
    ArtifactMapApiResponse,
    ArtifactMapResult,
    ArtifactResponse,
    ArtifactPatchRequest,
    ArtifactPatchResponse,
    ArtifactUploadBlobResponse,
    ArtifactSummaryResponse,
)

router = APIRouter(tags=["artifacts-v2"])
logger = logging.getLogger(__name__)


def _artifact_detail_payload(row: dict[str, object]) -> dict[str, object]:
    payload = row_to_dict(row, exclude={"artifact_blob"})
    artifact_blob = row.get("artifact_blob")
    payload["has_artifact_blob"] = artifact_blob is not None
    payload["artifact_blob_size"] = (
        len(artifact_blob) if artifact_blob is not None else 0
    )
    payload["artifact_blob_base64"] = (
        base64.b64encode(artifact_blob).decode("ascii")
        if artifact_blob is not None
        else None
    )
    return payload


@router.get(
    "/api/v2/artifacts", response_model=ApiListResponse[ArtifactSummaryResponse]
)
def list_artifacts(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> ApiListResponse[ArtifactSummaryResponse]:
    artifacts_repository = ArtifactsRepository(engine)
    artifact_rows = artifacts_repository.list_artifacts(query=query, limit=limit)
    items = [ArtifactSummaryResponse.model_validate(row) for row in artifact_rows]
    logger.info(
        "Listed artifact records from v2 artifacts endpoint (artifact_count=%s, query=%s, limit=%s)",
        len(items),
        query,
        limit,
    )
    return ApiListResponse[ArtifactSummaryResponse](
        message="Artifacts retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get(
    "/api/v2/artifacts/{artifact_id}", response_model=ApiResponse[ArtifactResponse]
)
def get_artifact(
    artifact_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[ArtifactResponse]:
    artifacts_repository = ArtifactsRepository(engine)
    row = artifacts_repository.fetch_artifact(artifact_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    artifact_response = ArtifactResponse.model_validate(_artifact_detail_payload(row))
    logger.info(
        "Loaded artifact record from v2 artifacts endpoint (artifact_id=%s)",
        artifact_id,
    )
    return ApiResponse[ArtifactResponse](
        message="Artifact retrieved successfully.",
        data=artifact_response,
    )


@router.post("/api/v2/artifacts/map", response_model=ArtifactMapApiResponse)
def map_artifacts(
    payload: ArtifactMapRequest,
    engine=Depends(get_engine),
) -> ArtifactMapApiResponse:
    artifacts_repository = ArtifactsRepository(engine)
    membership_rows = artifacts_repository.fetch_membership_mappings()
    sample_mapping_rows = artifacts_repository.fetch_sample_mappings()
    sample_rows = artifacts_repository.fetch_samples()

    if not membership_rows or not sample_mapping_rows:
        message = (
            "No artifact groups are configured."
            if not membership_rows
            else "No sample mappings are configured."
        )
        rejected_artifacts = [
            {
                "artifact_id": item.artifact_id,
                "artifact_name": item.artifact_name,
                "reason": message,
            }
            for item in payload.artifacts
        ]
        return ArtifactMapApiResponse(
            message=message,
            data=ArtifactMapResponse(
                mapped_artifacts=[],
                rejected_artifacts=rejected_artifacts,
                mapped_count=0,
                rejected_count=len(rejected_artifacts),
            ),
        )

    rules_by_group: dict[int, dict[str, list[dict[str, object]]]] = {}
    for row in membership_rows:
        group_rules = rules_by_group.setdefault(
            int(row["artifact_group_id"]), {"membership": [], "sample": []}
        )
        group_rules["membership"].append(row)

    for row in sample_mapping_rows:
        group_rules = rules_by_group.setdefault(
            int(row["artifact_group_id"]), {"membership": [], "sample": []}
        )
        group_rules["sample"].append(row)

    mapped_artifacts: list[ArtifactMapResult] = []
    rejected_artifacts: list[dict[str, object]] = []

    for item in payload.artifacts:
        source_row = artifacts_repository.fetch_artifact(item.artifact_id)
        if source_row is None:
            rejected_artifacts.append(
                {
                    "artifact_id": item.artifact_id,
                    "artifact_name": item.artifact_name,
                    "reason": "artifact not found",
                }
            )
            continue

        artifact_name = str(source_row.get("artifact_name") or "").strip()
        matched_group_ids: list[int] = []

        for artifact_group_id, group_rules in rules_by_group.items():
            for rule in group_rules["membership"]:
                artifact_field = str(rule.get("artifact_field") or "artifact_name")
                artifact_value = str(source_row.get(artifact_field) or "").strip()
                if _matches_text(
                    artifact_value,
                    str(rule.get("pattern") or ""),
                    str(rule.get("operator") or "contains"),
                    bool(rule.get("case_sensitive")),
                ):
                    matched_group_ids.append(artifact_group_id)
                    break

        if len(matched_group_ids) != 1:
            rejected_artifacts.append(
                {
                    "artifact_id": item.artifact_id,
                    "artifact_name": artifact_name,
                    "reason": "artifact matched zero or multiple membership mappings",
                }
            )
            continue

        artifact_group_id = matched_group_ids[0]
        sample_matches: list[dict[str, object]] = []

        for sample_row in sample_rows:
            for rule in rules_by_group[artifact_group_id]["sample"]:
                artifact_field = str(rule.get("artifact_field") or "artifact_name")
                sample_field = str(rule.get("sample_field") or "sample_name")
                artifact_value = str(source_row.get(artifact_field) or "").strip()
                sample_value = str(sample_row.get(sample_field) or "").strip()
                if _matches_text(
                    artifact_value,
                    sample_value,
                    str(rule.get("operator") or "contains"),
                    bool(rule.get("case_sensitive")),
                ):
                    sample_matches.append(sample_row)
                    break

        if len(sample_matches) != 1:
            rejected_artifacts.append(
                {
                    "artifact_id": item.artifact_id,
                    "artifact_name": artifact_name,
                    "reason": "artifact matched zero or multiple samples",
                }
            )
            continue

        sample_row = sample_matches[0]
        mapped_artifacts.append(
            ArtifactMapResult(
                artifact_id=item.artifact_id,
                artifact_name=artifact_name,
                originating_sample_id=str(sample_row["sample_id"]),
                artifact_group_id=artifact_group_id,
                artifact_category=str(
                    source_row.get("artifact_category") or "companion"
                ),
                artifact_mime_type=str(source_row.get("artifact_mime_type") or ""),
                created_at=source_row.get("created_at"),
                updated_at=source_row.get("updated_at"),
            )
        )

    response = ArtifactMapResponse(
        mapped_artifacts=mapped_artifacts,
        rejected_artifacts=rejected_artifacts,
        mapped_count=len(mapped_artifacts),
        rejected_count=len(rejected_artifacts),
    )
    logger.info(
        "Mapped artifact records in v2 artifacts endpoint (mapped_count=%s, rejected_count=%s)",
        response.mapped_count,
        response.rejected_count,
    )
    return ArtifactMapApiResponse(
        message="Artifacts mapped successfully.", data=response
    )


@router.post("/api/v2/artifacts", response_model=ArtifactCreateResponse)
def create_artifacts(
    payload: ArtifactCreateRequest,
    engine=Depends(get_engine),
) -> ArtifactCreateResponse:
    artifacts_repository = ArtifactsRepository(engine)
    created_rows: list[ArtifactResponse] = []

    for item in payload.artifacts:
        if not item.artifact_name.strip():
            raise HTTPException(status_code=400, detail="artifact_name is required")
        if not item.artifact_mime_type:
            raise HTTPException(
                status_code=400, detail="artifact_mime_type is required"
            )
        artifact_row = {
            "artifact_name": item.artifact_name.strip(),
            "originating_sample_id": None,
            "artifact_group_id": None,
            "artifact_group_name": None,
            "artifact_category": "companion",
            "artifact_blob": b"",
            "artifact_mime_type": item.artifact_mime_type,
        }

        artifact_id = artifacts_repository.insert_artifact(artifact_row)

        row = artifacts_repository.fetch_artifact(artifact_id)
        if row is None:
            raise HTTPException(
                status_code=500, detail="Failed to load artifact after create"
            )
        created_rows.append(
            ArtifactResponse.model_validate(_artifact_detail_payload(row))
        )

    logger.info(
        "Created or updated artifact records in v2 artifacts endpoint (artifact_count=%s)",
        len(created_rows),
    )
    return ArtifactCreateResponse(
        message="Artifacts persisted successfully.",
        data=created_rows,
    )


@router.put(
    "/api/v2/artifacts/{artifact_id}/blob", response_model=ArtifactUploadBlobResponse
)
async def upload_artifact_blob(
    artifact_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
    file: UploadFile = File(...),
) -> ArtifactUploadBlobResponse:
    artifacts_repository = ArtifactsRepository(engine)
    row = artifacts_repository.fetch_artifact(artifact_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    artifact_blob = await file.read()
    if not artifact_blob:
        raise HTTPException(status_code=400, detail="Artifact file is empty")

    updated = artifacts_repository.update_artifact_blob(
        artifact_id=artifact_id,
        artifact_blob=artifact_blob,
        artifact_mime_type=file.content_type,
    )
    if updated != 1:
        raise HTTPException(
            status_code=409, detail=f"Failed to update artifact blob: {artifact_id}"
        )

    logger.info(
        "Updated artifact blob in v2 artifacts endpoint (artifact_id=%s)", artifact_id
    )
    return ArtifactUploadBlobResponse(
        message="Artifact blob uploaded successfully.",
        data=[
            ArtifactResponse.model_validate(
                _artifact_detail_payload(
                    artifacts_repository.fetch_artifact(artifact_id) or {}
                )
            )
        ],
    )


@router.patch("/api/v2/artifacts", response_model=ArtifactPatchResponse)
def patch_artifacts(
    payload: ArtifactPatchRequest,
    engine=Depends(get_engine),
) -> ArtifactPatchResponse:
    artifacts_repository = ArtifactsRepository(engine)
    artifact_groups_repository = ArtifactGroupsRepository(engine)
    samples_repository = SamplesRepository(engine)
    updated_rows: list[ArtifactResponse] = []

    for item in payload.artifacts:
        existing = artifacts_repository.fetch_artifact(item.artifact_id)
        if existing is None:
            raise HTTPException(
                status_code=404, detail=f"Artifact not found: {item.artifact_id}"
            )

        update_row: dict[str, object] = {}
        if "artifact_group_id" in item.model_fields_set:
            if item.artifact_group_id is not None:
                artifact_group_row = artifact_groups_repository.fetch_artifact_group(
                    item.artifact_group_id
                )
                if artifact_group_row is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Artifact group not found: {item.artifact_group_id}",
                    )
                update_row["artifact_group_id"] = item.artifact_group_id
                update_row["artifact_group_name"] = (
                    item.artifact_group_name
                    or artifact_group_row.get("artifact_group_name")
                )
            else:
                update_row["artifact_group_id"] = None
                update_row["artifact_group_name"] = None
        if "originating_sample_id" in item.model_fields_set:
            originating_sample_id = (
                item.originating_sample_id.strip()
                if item.originating_sample_id
                else None
            )
            if (
                originating_sample_id is not None
                and samples_repository.fetch_sample(originating_sample_id) is None
            ):
                originating_sample_id = None
            update_row["originating_sample_id"] = originating_sample_id

        if update_row:
            updated = artifacts_repository.update_artifact(item.artifact_id, update_row)
            if updated != 1:
                raise HTTPException(
                    status_code=409,
                    detail=f"Failed to update artifact: {item.artifact_id}",
                )

        row = artifacts_repository.fetch_artifact(item.artifact_id)
        if row is None:
            raise HTTPException(
                status_code=500, detail="Failed to load artifact after patch"
            )
        updated_rows.append(
            ArtifactResponse.model_validate(_artifact_detail_payload(row))
        )

    logger.info(
        "Patched artifact records in v2 artifacts endpoint (artifact_count=%s)",
        len(updated_rows),
    )
    return ArtifactPatchResponse(
        message="Artifacts updated successfully.",
        data=updated_rows,
    )


@router.delete("/api/v2/artifacts/{artifact_id}", status_code=204)
def delete_artifact(
    artifact_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> Response:
    artifacts_repository = ArtifactsRepository(engine)
    row = artifacts_repository.fetch_artifact(artifact_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    deleted = artifacts_repository.delete_artifact(artifact_id)
    if deleted != 1:
        raise HTTPException(
            status_code=409, detail=f"Failed to delete artifact: {artifact_id}"
        )

    logger.info(
        "Deleted artifact record from v2 artifacts endpoint (artifact_id=%s)",
        artifact_id,
    )
    return Response(status_code=204)


@router.delete("/api/v2/artifacts", status_code=204)
def delete_artifacts(
    payload: ArtifactDeleteRequest = Body(...),
    engine=Depends(get_engine),
) -> Response:
    artifact_ids = [int(artifact_id) for artifact_id in payload.artifact_ids]
    if not artifact_ids:
        raise HTTPException(status_code=400, detail="artifact_ids is required")

    artifacts_repository = ArtifactsRepository(engine)
    unique_artifact_ids = list(dict.fromkeys(artifact_ids))
    missing_artifact_ids = [
        artifact_id
        for artifact_id in unique_artifact_ids
        if artifacts_repository.fetch_artifact(artifact_id) is None
    ]
    if missing_artifact_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown artifact_id(s): {', '.join(map(str, missing_artifact_ids))}",
        )

    deleted_count = artifacts_repository.delete_artifacts(unique_artifact_ids)
    if deleted_count != len(unique_artifact_ids):
        raise HTTPException(
            status_code=409, detail="Failed to delete all requested artifacts"
        )

    logger.info(
        "Deleted artifact records from v2 artifacts endpoint (artifact_count=%s)",
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
