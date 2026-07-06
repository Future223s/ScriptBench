from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.api.dependencies import get_engine, json_safe
from backend.database.repositories.samples_repository import SamplesRepository
from backend.models.groupings import GroupingCreateRequest, GroupingValueRequest

router = APIRouter(tags=["groupings"])


def _derive_groupings(samples_repository: SamplesRepository) -> list[dict[str, object]]:
    grouped_values: dict[str, dict[str, object]] = defaultdict(dict)
    grouped_sources: dict[str, str] = {}

    for sample_row in samples_repository.list_samples():
        sample_id = str(sample_row["sample_id"])
        sample_groups = sample_row["sample_groups"] or {}
        if isinstance(sample_groups, dict):
            for group_name, value in sample_groups.items():
                grouped_values[str(group_name)][sample_id] = value
                grouped_sources[str(group_name)] = "sample groups"

    return [
        {
            "name": group_name,
            "source": grouped_sources.get(group_name, "sample groups"),
            "assignments": json_safe(assignments),
        }
        for group_name, assignments in sorted(grouped_values.items())
    ]


@router.get("/api/v1/groupings")
def list_groupings(engine=Depends(get_engine)) -> dict[str, object]:
    samples_repository = SamplesRepository(engine)
    groupings = _derive_groupings(samples_repository)
    return {"groupings": groupings, "grouping_count": len(groupings)}


@router.post("/api/v1/groupings")
def create_grouping(
    payload: GroupingCreateRequest,
    engine=Depends(get_engine),
) -> dict[str, object]:
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Grouping name is required")

    sample_ids = list(dict.fromkeys(sample_id for sample_id in payload.sample_ids if sample_id.strip()))
    samples_repository = SamplesRepository(engine)
    missing_sample_ids = samples_repository.assign_samples_to_group(
        group_name=group_name,
        sample_ids=sample_ids,
    )
    if missing_sample_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
        )

    groupings = _derive_groupings(samples_repository)
    grouping = next(
        (item for item in groupings if item["name"] == group_name),
        {"name": group_name, "source": "sample groups", "assignments": {}},
    )
    return grouping

@router.post("/api/v1/groupings/{group_name}/values")
def add_grouping_value(
    payload: GroupingValueRequest,
    group_name: str = Path(..., min_length=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    group_name = group_name.strip()
    value = payload.value.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Grouping name is required")
    if not value:
        raise HTTPException(status_code=400, detail="Value name is required")

    sample_ids = list(dict.fromkeys(sample_id for sample_id in payload.sample_ids if sample_id.strip()))
    samples_repository = SamplesRepository(engine)
    missing_sample_ids = samples_repository.assign_sample_group_values(
        group_name=group_name,
        assignments={sample_id: value for sample_id in sample_ids},
    )
    if missing_sample_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
        )

    groupings = _derive_groupings(samples_repository)
    grouping = next(
        (item for item in groupings if item["name"] == group_name),
        {"name": group_name, "source": "sample groups", "assignments": {}},
    )
    return grouping

@router.delete("/api/v1/groupings/{group_name}")
def delete_grouping(
    group_name: str = Path(..., min_length=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    group_name = group_name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Grouping name is required")

    samples_repository = SamplesRepository(engine)
    groupings = _derive_groupings(samples_repository)
    if not any(group["name"] == group_name for group in groupings):
        raise HTTPException(status_code=404, detail="Grouping not found")

    updated_samples = samples_repository.delete_grouping(group_name)
    return {
        "group_name": group_name,
        "deleted": True,
        "updated_samples": updated_samples,
    }
