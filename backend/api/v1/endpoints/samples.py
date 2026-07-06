from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, UploadFile

from backend.api.dependencies import get_engine, row_to_dict
from backend.database.repositories.samples_repository import SamplesRepository

router = APIRouter(tags=["samples"])

@router.get("/api/v1/samples")
def list_samples(
    engine=Depends(get_engine),
    sample_group: str | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1),
) -> dict[str, object]:
    samples_repository = SamplesRepository(engine)
    sample_rows = samples_repository.list_samples(sample_group=sample_group)

    if query:
        query_value = query.casefold()
        sample_rows = [
            row
            for row in sample_rows
            if query_value in str(row["sample_id"]).casefold()
            or (
                row["sample_group"] is not None
                and query_value in str(row["sample_group"]).casefold()
            )
            or (
                row["ground_truth_text"] is not None
                and query_value in str(row["ground_truth_text"]).casefold()
            )
        ]
    if limit is not None:
        sample_rows = sample_rows[:limit]

    payload = []
    for row in sample_rows:
        sample_payload = row_to_dict(row, exclude={"sample_blob"})
        sample_blob = row["sample_blob"]
        sample_payload["has_sample_blob"] = sample_blob is not None
        sample_payload["sample_blob_size"] = len(sample_blob) if sample_blob is not None else 0
        payload.append(sample_payload)

    return {
        "samples": payload,
        "sample_count": len(payload),
    }

@router.get("/api/v1/samples/{sample_id}")
def get_sample(
    sample_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    samples_repository = SamplesRepository(engine)
    row = samples_repository.fetch_sample(sample_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sample not found")

    payload = row_to_dict(row, exclude={"sample_blob"})
    sample_blob = row["sample_blob"]
    payload["has_sample_blob"] = sample_blob is not None
    payload["sample_blob_size"] = len(sample_blob) if sample_blob is not None else 0
    payload["sample_blob_base64"] = row_to_dict({"sample_blob": sample_blob})["sample_blob"]
    return payload

@router.delete("/api/v1/samples/{sample_id}")
def delete_sample(
    sample_id: str = Path(..., min_length=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    samples_repository = SamplesRepository(engine)
    row = samples_repository.fetch_sample(sample_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sample not found")

    samples_repository.delete_sample(sample_id)
    return {"sample_id": sample_id, "deleted": True}


@router.post("/api/v1/samples")
async def create_sample(
    engine=Depends(get_engine),
    sample_id: str = Form(...),
    ground_truth_text: str | None = Form(default=None),
    file: UploadFile = File(...),
) -> dict[str, object]:
    sample_blob = await file.read()
    sample_mime_type = file.content_type
    samples_repository = SamplesRepository(engine)
    samples_repository.upsert_sample(
        sample_id=sample_id,
        sample_blob=sample_blob,
        sample_mime_type=sample_mime_type,
        ground_truth_text=ground_truth_text,
    )
    row = samples_repository.fetch_sample(sample_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load sample after upload")

    payload = row_to_dict(row, exclude={"sample_blob"})
    payload["has_sample_blob"] = True
    payload["sample_blob_size"] = len(sample_blob)
    return payload
