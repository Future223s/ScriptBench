from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class StepOutputRecord(BaseModel):
    id: int
    raw_output_id: int
    execution_job_id: int
    workflow_id: int
    workflow_step_id: int
    sample_id: str | None = None
    output_scope: str
    entity_type: Literal["document", "sample", "derivative"]
    entity_key: str
    output: Any = None
    cer: float | None = None
    wer: float | None = None
    hallucination_count: int | None = None
    created_at: datetime
    model_config = ConfigDict(extra='forbid')
