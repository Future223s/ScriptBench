from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

class SampleSetRecord(BaseModel):
    sample_set_id: int
    sample_set_name: str
    sample_set_description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
