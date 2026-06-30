from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class WorkflowConfig:
    workflow_name: str
    stage: str
    model_family: str
    model: str | None = None
    example_ids: Sequence[str] = field(default_factory=tuple)
    test_ids: Sequence[str] = field(default_factory=tuple)
    workflow_id: int | None = None
    logs_path: str | None = None
    status: str = "draft"
    prompt_template: Mapping[str, Any] | None = None
