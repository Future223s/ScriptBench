from __future__ import annotations

import logging
from collections import defaultdict
from math import ceil, floor

from fastapi import APIRouter, Depends, HTTPException, Path as FastAPIPath, Query
from sqlalchemy import func, select

from backend.api.dependencies import get_engine
from backend.database.repositories.sample_set_samples_repository import (
    SampleSetSamplesRepository,
)
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.samples_repository import SamplesRepository
from backend.database.tables.workflows_table import workflows
from backend.database.tables.execution_jobs_table import execution_jobs
from backend.database.tables.step_outputs_table import step_outputs
from backend.models.api import ApiResponse
from backend.models.sample_sets import (
    SampleSetCreateRequest,
    SampleSetCreateResponse,
    SampleSetDeleteResponse,
    SampleSetGetResponse,
    SampleSetListResponse,
    SampleSetResponse,
)

router = APIRouter(tags=["sample-sets-v2"])
logger = logging.getLogger(__name__)


def _with_sample_ids(row: dict, memberships: list[dict]) -> SampleSetResponse:
    return SampleSetResponse.model_validate(
        {
            **row,
            "sample_ids": [membership["sample_id"] for membership in memberships],
        }
    )


def _percentile(values: list[float], percentile: float) -> float:
    position = (len(values) - 1) * percentile
    lower = floor(position)
    upper = ceil(position)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def _metric_summary(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    ordered = sorted(values)
    return {
        "min": ordered[0],
        "q1": _percentile(ordered, 0.25),
        "median": _percentile(ordered, 0.5),
        "q3": _percentile(ordered, 0.75),
        "max": ordered[-1],
        "mean": sum(ordered) / len(ordered),
    }


@router.get("/api/v2/sample-sets", response_model=SampleSetListResponse)
def list_sample_sets(
    engine=Depends(get_engine),
    query: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> SampleSetListResponse:
    sample_sets_repository = SampleSetsRepository(engine)
    memberships_repository = SampleSetSamplesRepository(engine)
    items = [
        _with_sample_ids(
            row, memberships_repository.list_for_sample_set(row["id"])
        )
        for row in sample_sets_repository.list(query=query, status=status, limit=limit)
    ]
    logger.info(
        "Listed sample-set records from v2 endpoint (sample_set_count=%s)", len(items)
    )
    return SampleSetListResponse(
        message="Sample sets retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.get("/api/v2/sample-sets/{sample_set_id}", response_model=SampleSetGetResponse)
def get_sample_set(
    sample_set_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> SampleSetGetResponse:
    sample_sets_repository = SampleSetsRepository(engine)
    row = sample_sets_repository.fetch(sample_set_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sample set not found")
    memberships = SampleSetSamplesRepository(engine).list_for_sample_set(sample_set_id)
    sample_set = _with_sample_ids(row, memberships)
    logger.info(
        "Loaded sample-set record from v2 endpoint (sample_set_id=%s)", sample_set_id
    )
    return SampleSetGetResponse(
        message="Sample set retrieved successfully.", data=sample_set
    )


@router.get("/api/v2/sample-sets/{sample_set_id}/analytics")
def get_sample_set_analytics(
    sample_set_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> ApiResponse[dict[str, object]]:
    sample_set = SampleSetsRepository(engine).fetch(sample_set_id)
    if sample_set is None:
        raise HTTPException(status_code=404, detail="Sample set not found")
    memberships = SampleSetSamplesRepository(engine).list_for_sample_set(sample_set_id)
    with engine.connect() as connection:
        workflow_rows = (
            connection.execute(
                select(workflows)
                .where(workflows.c.sample_set_id == sample_set_id)
                .order_by(workflows.c.id)
            )
            .mappings()
            .all()
        )
    workflows_payload = [dict(row) for row in workflow_rows]
    analytics_by_workflow = {
        str(row["id"]): {
            "metrics": {"cer": None, "wer": None, "hallucinations": None},
            "completed_sample_count": 0,
        }
        for row in workflows_payload
    }
    if workflows_payload:
        workflow_ids = [row["id"] for row in workflows_payload]
        with engine.connect() as connection:
            completed_counts = {
                row["workflow_id"]: int(row["completed_sample_count"])
                for row in connection.execute(
                    select(
                        execution_jobs.c.workflow_id,
                        func.count(func.distinct(execution_jobs.c.id)).label(
                            "completed_sample_count"
                        ),
                    )
                    .select_from(
                        execution_jobs.outerjoin(
                            step_outputs,
                            step_outputs.c.execution_job_id
                            == execution_jobs.c.id,
                        )
                    )
                    .where(
                        execution_jobs.c.workflow_id.in_(workflow_ids),
                        execution_jobs.c.status == "completed",
                    )
                    .group_by(execution_jobs.c.workflow_id)
                ).mappings()
            }
            metric_values: dict[int, dict[str, list[float]]] = defaultdict(
                lambda: {"cer": [], "wer": []}
            )
            metric_rows = connection.execute(
                select(
                    execution_jobs.c.workflow_id,
                    step_outputs.c.cer,
                    step_outputs.c.wer,
                )
                .select_from(
                    execution_jobs.outerjoin(
                        step_outputs,
                        step_outputs.c.execution_job_id
                        == execution_jobs.c.id,
                    )
                )
                .where(
                    execution_jobs.c.workflow_id.in_(workflow_ids),
                    execution_jobs.c.status == "completed",
                )
            ).mappings()
            for row in metric_rows:
                values = metric_values[int(row["workflow_id"])]
                for metric in ("cer", "wer"):
                    value = row[metric]
                    if value is not None:
                        values[metric].append(float(value))
            for workflow_id, values in metric_values.items():
                analytics_by_workflow[str(workflow_id)] = {
                    "metrics": {
                        "cer": _metric_summary(values["cer"]),
                        "wer": _metric_summary(values["wer"]),
                        "hallucinations": None,
                    },
                    "completed_sample_count": completed_counts.get(workflow_id, 0),
                }
    return ApiResponse(
        message="Sample-set analytics retrieved.",
        data={
            "sample_set": _with_sample_ids(sample_set, memberships).model_dump(),
            "sample_ids": [membership["sample_id"] for membership in memberships],
            "sample_count": len(memberships),
            "workflows": workflows_payload,
            "workflow_count": len(workflows_payload),
            "analytics_by_workflow": analytics_by_workflow,
        },
    )


@router.post("/api/v2/sample-sets", response_model=SampleSetCreateResponse)
def create_sample_set(
    payload: SampleSetCreateRequest,
    engine=Depends(get_engine),
) -> SampleSetCreateResponse:
    name = payload.name.strip()
    description = (
        payload.description.strip()
        if payload.description is not None
        else None
    )
    sample_ids = [
        sample_id.strip() for sample_id in payload.sample_ids if sample_id.strip()
    ]
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if len(sample_ids) != len(set(sample_ids)):
        raise HTTPException(
            status_code=400, detail="sample_ids must not contain duplicates"
        )

    samples_repository = SamplesRepository(engine)
    missing_sample_ids = [
        sample_id
        for sample_id in sample_ids
        if samples_repository.fetch_sample(sample_id) is None
    ]
    if missing_sample_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
        )

    sample_sets_repository = SampleSetsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    with engine.begin() as conn:
        sample_set_id = sample_sets_repository.insert(
            {
                "name": name,
                "description": description or None,
                "status": "draft",
            },
            conn=conn,
        )
        for position, sample_id in enumerate(sample_ids):
            sample_set_samples_repository.insert(
                {
                    "sample_set_id": sample_set_id,
                    "sample_id": sample_id,
                    "position": position,
                },
                conn=conn,
            )

    row = sample_sets_repository.fetch(sample_set_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load sample set after create"
        )
    sample_set = _with_sample_ids(
        row,
        sample_set_samples_repository.list_for_sample_set(sample_set_id),
    )
    logger.info(
        "Created sample-set record in v2 endpoint (sample_set_id=%s, sample_count=%s)",
        sample_set_id,
        len(sample_ids),
    )
    return SampleSetCreateResponse(
        message="Sample set created successfully.", data=sample_set
    )


@router.delete(
    "/api/v2/sample-sets/{sample_set_id}", response_model=SampleSetDeleteResponse
)
def delete_sample_set(
    sample_set_id: int = FastAPIPath(..., ge=1),
    engine=Depends(get_engine),
) -> SampleSetDeleteResponse:
    sample_sets_repository = SampleSetsRepository(engine)
    if sample_sets_repository.fetch(sample_set_id) is None:
        raise HTTPException(status_code=404, detail="Sample set not found")
    deleted = sample_sets_repository.delete(sample_set_id)
    if deleted != 1:
        raise HTTPException(
            status_code=409, detail=f"Failed to delete sample set: {sample_set_id}"
        )
    logger.info(
        "Deleted sample-set record from v2 endpoint (sample_set_id=%s)", sample_set_id
    )
    return SampleSetDeleteResponse(message="Sample set deleted successfully.")
