from __future__ import annotations

from typing import Any

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
        return "Demo transcription output."

    def translate_error(self, exc: Exception) -> StepExecutionError | None:
        return None
