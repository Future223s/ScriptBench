from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PayloadTemplateRecord(BaseModel):
    payload_template_id: int
    payload_template_name: str
    version: int
    payload_template: dict[str, object]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(extra="forbid")
