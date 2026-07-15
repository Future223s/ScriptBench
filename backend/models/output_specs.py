from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OutputSpecRecord(BaseModel):
    output_spec_id: int
    output_spec_name: str
    version: int
    type: str
    item_schema: dict[str, object] | None = None
    instructions: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
