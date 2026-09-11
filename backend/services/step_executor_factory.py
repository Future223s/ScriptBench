from __future__ import annotations

from typing import Any

from backend.services.dev_settings import DevSettings
from backend.services.executor_validation import validate_config
from backend.database.repositories.step_executors_repository import StepExecutorsRepository
from backend.services.clients.anthropic_client import AnthropicClient
from backend.services.step_executor import StepExecutor
from backend.services.clients.gemini_client import GeminiClient
from backend.services.clients.stub_client import StubModelClient


class StepExecutorFactory:
    """Creates the configured model client for an execution step."""

    def __init__(
        self,
        engine,
        *,
        settings: DevSettings | None = None,
    ) -> None:
        self.repository = StepExecutorsRepository(engine)
        self.settings = settings if settings is not None else DevSettings.from_environment()

    def for_step(self, workflow_step: dict[str, Any]) -> StepExecutor:
        name = str(workflow_step.get("step_executor_id") or "")
        definition = self.repository.fetch(name)
        method = workflow_step["method"]
        config = validate_config(definition, workflow_step.get("executor_config") or {}, method)
        # This registry contains executable implementations only, never UI metadata.
        implementations = {
            "gemini": (GeminiClient, ("transcribe",)),
            "anthropic": (AnthropicClient, ("transcribe",)),
        }
        if name not in implementations or method not in implementations[name][1]:
            raise ValueError(f"No implementation registered for {name}.{method}")
        settings = self.settings.snapshot()
        if settings["stub_mode"]:
            client = StubModelClient(model=config["model"], fail=settings["stub_fail"])
        else:
            client = implementations[name][0](**config)
        client.name = definition["name"]
        client.definition = dict(definition)
        client.methods = {item["name"]: item for item in definition["methods"]}
        client.operations = {
            operation: getattr(client, operation)
            for operation in implementations[name][1]
            if operation in client.methods
        }
        return client
