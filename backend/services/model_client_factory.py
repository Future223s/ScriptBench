from __future__ import annotations

import os
from datetime import timedelta
from typing import Any

from backend.core.model_client import ModelClient
from backend.services.clients.gemini_client import GeminiClient
from backend.services.clients.stub_client import StubModelClient


class ModelClientFactory:
    """Creates the configured model client for an execution step."""

    def __init__(
        self,
        *,
        file_ttl: timedelta = timedelta(hours=24),
        testing_mode: bool | None = None,
    ) -> None:
        self.file_ttl = file_ttl
        self.testing_mode = (
            _env_flag("TESTING_MODE") if testing_mode is None else testing_mode
        )

    def for_step(self, workflow_step: dict[str, Any]) -> ModelClient:
        model_family = str(workflow_step.get("model_family") or "").casefold()
        if model_family == "gemini":
            if self.testing_mode:
                return StubModelClient(
                    model=str(workflow_step["model"]),
                    file_ttl=self.file_ttl,
                    fail=_env_flag("STUB_MODEL_FAIL"),
                )
            return GeminiClient(
                model=str(workflow_step["model"]),
                file_ttl=self.file_ttl,
            )
        raise ValueError(f"No model client registered for model family: {model_family}")


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().casefold() in {"1", "true", "yes", "on"}
