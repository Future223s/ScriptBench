from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.core.llm_models import File
from backend.core.model_client import ModelClient


class StubModelClient(ModelClient):
    """Deterministic model client used only when testing mode is enabled."""

    def __init__(
        self,
        *,
        model: str,
        file_ttl: timedelta = timedelta(hours=24),
        fail: bool = False,
    ) -> None:
        super().__init__(model=model, api_key="testing", file_ttl=file_ttl)
        self.fail = fail

    async def transcribe(self, payload: dict[str, Any]) -> str:
        import random
        import asyncio

        await asyncio.sleep(random.uniform(0, 5))
        if self.fail:
            raise RuntimeError("Stub model failure requested.")
        return "Demo transcription output."

    async def upload_file(self, file_blob: File) -> File:
        file_blob.uploaded_ref = f"{file_blob.source_id}_stubbed_ref"
        file_blob.uploaded_uri = f"{file_blob.source_id}_stubbed_uri"
        file_blob.uploaded_at = datetime.now(timezone.utc)
        return file_blob
