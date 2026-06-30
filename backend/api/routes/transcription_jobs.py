from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, ConfigDict

from backend.api.dependencies import get_engine, json_safe
from backend.database.repositories.transcription_job_samples_repository import (
    TranscriptionJobSamplesRepository,
)
from backend.database.repositories.transcription_jobs_repository import (
    TranscriptionJobsRepository,
)

router = APIRouter(tags=["transcription-jobs"])


class TranscriptionJobUpdateRequest(BaseModel):
    status: str | None = None
    raw_content: str | None = None
    failure_reason: str | None = None
    time_elapsed: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    resolved_prompt: dict[str, Any] | list[Any] | str | None = None

    model_config = ConfigDict(extra="forbid")


def _job_payload(
    *,
    job_row,
    transcription_job_samples_repository: TranscriptionJobSamplesRepository,
) -> dict[str, object]:
    payload = {str(key): json_safe(value) for key, value in dict(job_row).items()}
    try:
        payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(
            int(job_row["job_id"])
        )
    except Exception:
        payload["sample_ids"] = []
    return payload


@router.get("/api/transcription-jobs/{job_id}")
def get_transcription_job(
    job_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)

    job_row = transcription_jobs_repository.fetch_transcription_job(job_id)
    if job_row is None:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    return _job_payload(
        job_row=job_row,
        transcription_job_samples_repository=transcription_job_samples_repository,
    )


@router.patch("/api/transcription-jobs/{job_id}")
def update_transcription_job(
    payload: TranscriptionJobUpdateRequest,
    job_id: int = Path(..., ge=1),
    engine=Depends(get_engine),
) -> dict[str, object]:
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)

    existing_job = transcription_jobs_repository.fetch_transcription_job(job_id)
    if existing_job is None:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    update_fields = payload.model_dump(exclude_unset=True)
    if update_fields:
        transcription_jobs_repository.update_transcription_job(job_id, **update_fields)

    refreshed_job = transcription_jobs_repository.fetch_transcription_job(job_id)
    if refreshed_job is None:
        raise HTTPException(status_code=500, detail="Failed to refresh transcription job")

    return _job_payload(
        job_row=refreshed_job,
        transcription_job_samples_repository=transcription_job_samples_repository,
    )
