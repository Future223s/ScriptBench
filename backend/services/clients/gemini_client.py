from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.core.llm_models import File
from backend.core.model_client import ModelClient


class GeminiClient(ModelClient):
    """Gemini adapter for completed native Gemini request JSON."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str | None = None,
        temperature: float = 0.0,
        file_ttl: timedelta = timedelta(hours=24),
    ) -> None:
        load_dotenv(override=True)
        resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not resolved_api_key:
            raise EnvironmentError("GEMINI_API_KEY is required")
        super().__init__(
            model=model,
            api_key=resolved_api_key,
            temperature=temperature,
            file_ttl=file_ttl,
        )
        self.client = genai.Client(api_key=resolved_api_key)

    async def transcribe(self, payload: dict[str, Any]) -> str:
        contents = [self._content(content) for content in payload.get("contents", [])]
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(temperature=self.temperature),
        )
        return response.text or ""

    async def upload_file(self, file_blob: File) -> File:
        if file_blob.blob is None:
            raise ValueError(f"File blob is missing for {file_blob.source_id}")
        uploaded = await asyncio.to_thread(
            self.client.files.upload,
            file=BytesIO(file_blob.blob),
            config={
                "display_name": file_blob.source_id,
                "mime_type": file_blob.mime_type,
            },
        )
        file_blob.uploaded_ref = str(getattr(uploaded, "name", "")) or None
        file_blob.uploaded_uri = str(getattr(uploaded, "uri", "")) or None
        file_blob.uploaded_at = datetime.now(timezone.utc)
        if not file_blob.uploaded_ref:
            raise RuntimeError("Gemini did not return an uploaded file reference")
        return file_blob

    async def refresh_file_ref(
        self,
        file_blob: File,
        time_since_last_updated: timedelta | None,
    ) -> File:
        if file_blob.transport == "inline" or (
            file_blob.transport == "auto"
            and file_blob.blob is not None
            and len(file_blob.blob) <= 20 * 1024 * 1024
        ):
            return file_blob
        if (
            file_blob.uploaded_ref
            and time_since_last_updated is not None
            and time_since_last_updated <= self.file_ttl
        ):
            try:
                uploaded = await asyncio.to_thread(
                    self.client.files.get,
                    name=file_blob.uploaded_ref,
                )
                file_blob.uploaded_uri = str(getattr(uploaded, "uri", "")) or None
                return file_blob
            except Exception:
                pass
        return await self.upload_file(file_blob)

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
