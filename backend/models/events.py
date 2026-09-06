from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EventPayload(BaseModel):
    """Canonical event envelope for changed records."""

    event: str
    message: str
    rows: list[dict[str, Any]] = Field(default_factory=list)

    @classmethod
    def build(
        cls,
        *,
        event: str,
        message: str,
        rows: list[dict[str, Any]] | None = None,
    ) -> "EventPayload":
        return cls(
            event=event,
            message=message,
            rows=[dict(row) for row in (rows or [])],
        )
