from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from typing import Any

from .llm_models import File


class ModelClient(ABC):
    """Stateless provider adapter for one model configuration.

    File references are deliberately carried by ``File`` instances. This
    module does not persist or share them between workflows or transactions.
    """

    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        temperature: float = 0.0,
        file_ttl: timedelta = timedelta(hours=24),
    ) -> None:
        if not model.strip():
            raise ValueError("model is required")
        if not api_key.strip():
            raise ValueError("api_key is required")
        if not 0 <= temperature <= 2:
            raise ValueError("temperature must be between 0 and 2")
        if file_ttl <= timedelta(0):
            raise ValueError("file_ttl must be positive")

        self.model = model
        self.api_key = api_key
        self.temperature = temperature
        self.file_ttl = file_ttl

    @abstractmethod
    async def transcribe(
        self,
        payload: dict[str, Any],
    ) -> str:
        """Send one fully resolved provider-shaped payload to the model."""

    @abstractmethod
    async def upload_file(self, file_blob: File) -> File:
        """Upload one file and return it with its provider reference populated."""

    async def refresh_file_ref(
        self,
        file_blob: File,
        time_since_last_updated: timedelta | None,
    ) -> File:
        """Reuse a fresh reference or upload the file when it is stale.

        A provider adapter may additionally validate the reference with the
        provider. The default policy is intentionally provider-neutral.
        """
        if (
            file_blob.uploaded_ref
            and time_since_last_updated is not None
            and time_since_last_updated <= self.file_ttl
        ):
            return file_blob
        return await self.upload_file(file_blob)
