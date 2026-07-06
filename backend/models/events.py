from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .jobs import TranscriptionJobRecord


class JobEventPayload(BaseModel):
    event: str
    type: str
    message: str
    workflow_id: int | None = None
    job_id: int | None = None
    status: str | None = None
    job: TranscriptionJobRecord | dict[str, Any]

    @classmethod
    def build(
        cls,
        *,
        event: str,
        message: str,
        job_payload: dict[str, Any] | TranscriptionJobRecord,
    ) -> "JobEventPayload":
        if isinstance(job_payload, TranscriptionJobRecord):
            payload = job_payload.model_dump()
        else:
            payload = job_payload

        return cls(
            event=event,
            type=event,
            message=message,
            workflow_id=payload.get("workflow_id"),
            job_id=payload.get("job_id"),
            status=payload.get("status"),
            job=payload,
        )
