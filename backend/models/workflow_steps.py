from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkflowStepRecord(BaseModel):
    workflow_step_id: int
    step_name: str
    version: int
    model_family: str
    model: str | None = None
    payload_template_id: int | None = None
    output_spec_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
