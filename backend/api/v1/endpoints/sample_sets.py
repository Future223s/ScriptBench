from __future__ import annotations

from collections import defaultdict
from statistics import mean, median, pstdev

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.api.dependencies import get_engine, row_to_dict
from backend.database.repositories.sample_sets_repository import SampleSetsRepository
from backend.database.repositories.sample_set_samples_repository import SampleSetSamplesRepository
from backend.database.repositories.samples_repository import SamplesRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.database.repositories.workflow_metrics_repository import WorkflowMetricsRepository
from backend.models.api import SampleSetCreateRequest

router = APIRouter(tags=["sample-sets-v1"])

def _sample_set_payload(
    *,
    sample_set_row,
    sample_ids: list[str],
    workflow_count: int,
) -> dict[str, object]:
    payload = row_to_dict(sample_set_row)
    payload["sample_ids"] = sample_ids
    payload["sample_count"] = len(sample_ids)
    payload["sample_ids_preview"] = sample_ids[:5]
    payload["workflow_count"] = workflow_count
    return payload


@router.get("/api/v1/sample-sets")
def list_sample_sets(engine=Depends(get_engine)) -> dict[str, object]:
    sample_sets_repository = SampleSetsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    workflows_repository = WorkflowsRepository(engine)

    sample_set_rows = sample_sets_repository.list_sample_sets()
    payload = []
    for sample_set_row in sample_set_rows:
        sample_set_id = int(sample_set_row["sample_set_id"])
        sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(sample_set_id)
        workflow_count = len(workflows_repository.list_workflows_for_sample_set(sample_set_id))
        payload.append(
            _sample_set_payload(
                sample_set_row=sample_set_row,
                sample_ids=sample_ids,
                workflow_count=workflow_count,
            )
        )

    return {
        "sample_sets": payload,
        "sample_set_count": len(payload),
    }


@router.post("/api/v1/sample-sets")
def create_sample_set(
    payload: SampleSetCreateRequest,
    engine=Depends(get_engine),
) -> dict[str, object]:
    sample_sets_repository = SampleSetsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    samples_repository = SamplesRepository(engine)

    sample_ids = list(dict.fromkeys(sample_id for sample_id in payload.sample_ids if sample_id.strip()))
    if sample_ids:
        missing_sample_ids = [
            sample_id for sample_id in sample_ids if samples_repository.fetch_sample(sample_id) is None
        ]
        if missing_sample_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown sample_id(s): {', '.join(missing_sample_ids)}",
            )

    sample_set_id = sample_sets_repository.insert_sample_set(
        sample_set_name=payload.sample_set_name,
        sample_set_description=payload.sample_set_description,
        sample_set_type=payload.sample_set_type,
    )
    if sample_ids:
        sample_set_samples_repository.replace_sample_set_samples(
            sample_set_id=sample_set_id,
            sample_ids=sample_ids,
        )

    sample_set_row = sample_sets_repository.fetch_sample_set(sample_set_id)
    if sample_set_row is None:
        raise HTTPException(status_code=500, detail="Failed to load sample set after create")

    return _sample_set_payload(
        sample_set_row=sample_set_row,
        sample_ids=sample_ids,
        workflow_count=0,
    )


@router.delete("/api/v1/sample-sets/{sample_set_id}")
def delete_sample_set(
    sample_set_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    sample_sets_repository = SampleSetsRepository(engine)
    workflows_repository = WorkflowsRepository(engine)
    sample_set_row = sample_sets_repository.fetch_sample_set(sample_set_id)
    if sample_set_row is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    for workflow_row in workflows_repository.list_workflows_for_sample_set(sample_set_id):
        workflows_repository.delete_workflow(int(workflow_row["workflow_id"]))

    sample_sets_repository.delete_sample_set(sample_set_id)
    return {"sample_set_id": sample_set_id, "deleted": True}


@router.get("/api/v1/sample-sets/{sample_set_id}/analytics")
def get_sample_set_analytics(
    sample_set_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    sample_sets_repository = SampleSetsRepository(engine)
    sample_set_samples_repository = SampleSetSamplesRepository(engine)
    workflows_repository = WorkflowsRepository(engine)
    workflow_metrics_repository = WorkflowMetricsRepository(engine)
    sample_set_row = sample_sets_repository.fetch_sample_set(sample_set_id)
    if sample_set_row is None:
        raise HTTPException(status_code=404, detail="Sample set not found")

    sample_ids = sample_set_samples_repository.fetch_sample_set_sample_ids(sample_set_id)
    workflow_rows = workflows_repository.list_workflows_for_sample_set(sample_set_id)
    metric_rows = []
    for workflow_row in workflow_rows:
        metrics_row = workflow_metrics_repository.fetch_workflow_metrics(
            int(workflow_row["workflow_id"])
        )
        if metrics_row is not None:
            metric_rows.append((workflow_row, metrics_row))

    summaries: dict[str, object] = {}
    for metric_name in (
        "cer",
        "wer",
        "hallucinations",
        "line_omission_count",
        "line_addition_count",
    ):
        values = [
            float(metrics_row[metric_name])
            for _workflow_row, metrics_row in metric_rows
            if metrics_row.get(metric_name) is not None
        ]
        if not values:
            continue

        best_workflow = min(
            (
                {
                    "workflow": row_to_dict(workflow_row),
                    "value": float(metrics_row[metric_name]),
                }
                for workflow_row, metrics_row in metric_rows
                if metrics_row.get(metric_name) is not None
            ),
            key=lambda item: item["value"],
        )
        worst_workflow = max(
            (
                {
                    "workflow": row_to_dict(workflow_row),
                    "value": float(metrics_row[metric_name]),
                }
                for workflow_row, metrics_row in metric_rows
                if metrics_row.get(metric_name) is not None
            ),
            key=lambda item: item["value"],
        )
        summaries[metric_name] = {
            "best_workflow": best_workflow,
            "worst_workflow": worst_workflow,
            "min": min(values),
            "max": max(values),
            "median": median(values),
            "mean": mean(values),
            "std": pstdev(values) if len(values) > 1 else 0.0,
        }

    return {
        "sample_set": row_to_dict(sample_set_row),
        "sample_ids": sample_ids,
        "sample_count": len(sample_ids),
        "workflow_count": len(workflow_rows),
        "workflows": [row_to_dict(row) for row in workflow_rows],
        "metrics": summaries,
    }
