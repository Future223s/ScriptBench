from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class RawOutputRecord(BaseModel):
    id: int
    execution_job_id: int
    workflow_id: int
    workflow_step_id: int
    attempt_no: int
    assembled_model_payload: dict[str, Any]
    raw_model_response: str
    parsed_output: Any = None
    raw_individual_outputs: Any = None
    complete_output: Any = None
    parse_status: Literal["success", "failed"]
    parse_error: str | None = None
    repair_applied: bool = False
    repair_details: str | None = None
    time_elapsed: float
    started_at: datetime
    completed_at: datetime
    created_at: datetime

    model_config = ConfigDict(extra="forbid")
