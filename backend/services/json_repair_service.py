from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from json_repair import repair_json


@dataclass(frozen=True)
class JsonRepairResult:
    value: Any = None
    error: str | None = None
    repair_applied: bool = False
    repair_details: str | None = None


class JsonRepairService:
    """Parse provider JSON strictly, repairing syntax only after strict failure."""

    @staticmethod
    def parse(raw_response: str) -> JsonRepairResult:
        try:
            return JsonRepairResult(value=json.loads(raw_response))
        except json.JSONDecodeError as strict_error:
            details = f"Strict JSON parsing failed: {strict_error}"

        try:
            repaired = repair_json(
                raw_response,
                return_objects=True,
                skip_json_loads=True,
            )
        except Exception as repair_error:
            return JsonRepairResult(
                error=f"{details}; JSON repair failed: {repair_error}",
                repair_applied=True,
                repair_details=details,
            )

        return JsonRepairResult(
            value=repaired,
            repair_applied=True,
            repair_details=details,
        )
