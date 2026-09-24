from __future__ import annotations

from typing import Any
import json

from backend.services.step_executor import StepExecutionError, StepExecutor


class StubModelClient(StepExecutor):
    """Deterministic model client used only when testing mode is enabled."""

    def __init__(
        self,
        *,
        model: str,
        fail: bool = False,
    ) -> None:
        super().__init__(name=model)
        self.fail = fail

    async def transcribe(self, payload: dict[str, Any]) -> str:
        import random
        import asyncio

        await asyncio.sleep(random.uniform(0, 5))
        if self.fail:
            raise RuntimeError("Stub model failure requested.")
        entity_ids = list(
            (payload.get("_scriptbench_output_contract") or {}).get("entity_ids") or []
        )
        if entity_ids:
            return json.dumps(
                {str(entity_id): "Demo transcription output." for entity_id in entity_ids}
            )
        return "Demo transcription output."

    def translate_error(self, exc: Exception) -> StepExecutionError | None:
        return None
