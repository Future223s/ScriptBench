from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

class WorkflowRecord(BaseModel):
    workflow_id: int
    workflow_name: str
    sample_set_id: int | None = None
    workflow_description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
