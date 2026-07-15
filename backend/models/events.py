from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class JobEventPayload(BaseModel):
    event: str
    message: str
    job: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def build(
        cls,
        *,
        event: str,
        message: str,
        job_payload: dict[str, Any] | None = None,
    ) -> "JobEventPayload":
        return cls(
            event=event,
            message=message,
            job=dict(job_payload or {}),
        )
