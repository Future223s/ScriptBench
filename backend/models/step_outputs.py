from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class StepOutputRecord(BaseModel):
    id: int
    execution_job_id: int
    workflow_id: int
    workflow_step_id: int
    sample_id: str
    attempt_no: int
    assembled_model_payload: dict[str, Any]
    raw_model_response: str
    parsed_output: Any = None
    parse_status: Literal['success', 'failed'] | None = None
    parse_error: str | None = None
    cer: float | None = None
    wer: float | None = None
    hallucination_count: int | None = None
    time_elapsed: float
    started_at: datetime
    completed_at: datetime
    created_at: datetime
    model_config = ConfigDict(extra='forbid')
