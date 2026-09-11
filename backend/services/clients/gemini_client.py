from __future__ import annotations

import asyncio
import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

from backend.services.step_executor import StepError, StepExecutionError, StepExecutor


class GeminiClient(StepExecutor):
    """Gemini adapter for completed native Gemini request JSON."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str | None = None,
        temperature: float = 0.0,
        max_tokens: int | None = None,
    ) -> None:
        load_dotenv(override=True)
        resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not resolved_api_key:
            raise EnvironmentError("GEMINI_API_KEY is required")
        if not model.strip():
            raise ValueError("model is required")
        if not 0 <= temperature <= 2:
            raise ValueError("temperature must be between 0 and 2")
        super().__init__(name=model)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.client = genai.Client(api_key=resolved_api_key)

    async def transcribe(self, payload: dict[str, Any]) -> str:
        contents = [self._content(content) for content in payload.get("contents", [])]
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(temperature=self.temperature, max_output_tokens=self.max_tokens),
        )
        return response.text or ""

    def translate_error(self, exc: Exception) -> StepExecutionError | None:
        if not isinstance(exc, errors.APIError):
            return None
        status = exc.code
        code = {
            400: "invalid_input",
            401: "authentication_required",
            403: "permission_denied",
            404: "not_found",
            429: "rate_limited",
        }.get(status, "provider_error")
        return StepExecutionError(
            StepError(
                message=str(exc),
                code=code,
                retryable=status in {429, 500, 502, 503, 504},
            )
        )

    @staticmethod
    def _content(content: dict[str, Any]) -> types.Content:
        return types.Content(
            role=str(content.get("role", "user")),
            parts=[GeminiClient._part(part) for part in content.get("parts", [])],
        )

    @staticmethod
    def _part(part: dict[str, Any]) -> types.Part:
        if "text" in part:
            return types.Part.from_text(text=str(part["text"]))
        inline_data = part.get("inline_data")
        if isinstance(inline_data, dict):
            data = inline_data.get("data")
            if not isinstance(data, bytes):
                raise TypeError("inline_data.data must resolve to bytes")
            return types.Part.from_bytes(
                data=data,
                mime_type=str(inline_data["mime_type"]),
            )
        raise ValueError("Each Gemini part must contain text or inline_data")
