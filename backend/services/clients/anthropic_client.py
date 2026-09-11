from __future__ import annotations
from backend.services.step_executor import StepExecutor, StepExecutionError, StepError
from anthropic import (
    AsyncClient, AuthenticationError, NotFoundError,
    RateLimitError, InternalServerError,
)
import os
import base64
from copy import deepcopy
from typing import Any

class AnthropicClient(StepExecutor):
    def __init__(self, model: str, max_tokens: int, temperature: float | None = None) -> None:
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.client = AsyncClient(api_key=os.getenv("ANTHROPIC_API_KEY"))
        super().__init__(name="AnthropicClient")

    async def transcribe(self, payload: dict[str, Any]) -> str:
        messages = deepcopy(payload["messages"])
        for message in messages:
            content = message.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                source = block.get("source", {})
                if block.get("type") == "image" and source.get("type") == "base64":
                    if isinstance(source.get("data"), bytes):
                        source["data"] = base64.b64encode(source["data"]).decode("ascii")
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=messages,
            **({"temperature": self.temperature} if self.temperature is not None else {}),
        )
        return "".join(block.text for block in response.content if block.type == "text")

    def translate_error(self, exc: Exception) -> StepExecutionError | None:
        if isinstance(exc, AuthenticationError):
            code, retryable = "authentication_required", False
        elif isinstance(exc, NotFoundError):
            code, retryable = "not_found", False
        elif isinstance(exc, RateLimitError):
            code, retryable = "rate_limited", False
        elif isinstance(exc, InternalServerError):
            code, retryable = "provider_error", False
        else:
            return None
        return StepExecutionError(
            StepError(message=str(exc), code=code, retryable=retryable)
        )
