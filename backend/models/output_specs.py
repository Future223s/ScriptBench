from __future__ import annotations

from datetime import datetime

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from .api import ApiResponse


class OutputSpecRecord(BaseModel):
    output_spec_id: int
    output_spec_name: str
    type: str
    item_schema: dict[str, Any] | None = None
    instructions: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class OutputSpecCreateRequest(BaseModel):
    output_spec_name: str
    type: Literal["plain-text", "json"]
    item_schema: dict[str, Any] | None = None
    instructions: str | None = None

    model_config = ConfigDict(extra="forbid")


class OutputSpecCreateResponse(ApiResponse[OutputSpecRecord]):
    pass
