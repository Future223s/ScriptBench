from datetime import datetime
from typing import Any
from pydantic import BaseModel


class StepExecutorSummary(BaseModel):
    id: str
    name: str
    description: str


class ExecutorMethod(BaseModel):
    name: str
    label: str
    description: str


class StepExecutorRecord(StepExecutorSummary):
    config_schema: dict[str, Any]
    methods: list[ExecutorMethod]
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    active: bool
    created_at: datetime
    updated_at: datetime
