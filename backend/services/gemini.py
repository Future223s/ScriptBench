from __future__ import annotations

import asyncio
import json
import os
from io import BytesIO
from datetime import datetime, timedelta, timezone
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.core.transcription_engine import (
    DEFAULT_IMAGE_EXTENSIONS,
    TranscriptionEngine,
)
from backend.core.workflow_config import WorkflowConfig
from backend.database.repositories.sample_uploads_repository import SampleUploadsRepository


class GeminiClient(TranscriptionEngine):
    def __init__(
        self,
        workflow_config: WorkflowConfig,
        image_dir: Path | None = None,
        cache_registry_path: Path | None = None,
        image_extensions: tuple[str, ...] = DEFAULT_IMAGE_EXTENSIONS,
        sample_uploads_repository: SampleUploadsRepository | None = None,
    ) -> None:
        super().__init__(
            workflow_config=workflow_config,
            image_dir=image_dir or Path("."),
            image_extensions=image_extensions,
        )
        load_dotenv(override=True)
        self.cache_registry_path = cache_registry_path
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise EnvironmentError("GEMINI_API_KEY is required")
        self.model_spec = workflow_config.model or os.getenv(
            "GEMINI_MODEL",
            "gemini-3-flash-preview",
        )
        self.client = genai.Client(api_key=self.api_key)
        self.sample_uploads_repository = sample_uploads_repository

    async def _upload_sample(
        self,
        sample_id: str,
        sample_blob: bytes,
        sample_mime_type: str | None,
    ) -> object:
        upload_config: dict[str, object] = {"display_name": sample_id}
        if sample_mime_type is not None:
            upload_config["mime_type"] = sample_mime_type

        sample_file = BytesIO(sample_blob)
        sample_file.seek(0)
        return await asyncio.to_thread(
            self.client.files.upload,
            file=sample_file,
            config=upload_config,
        )

    async def _get_file_ref(self, ref_name: str) -> object:
        return await asyncio.to_thread(self.client.files.get, name=ref_name)

    async def refresh_sample_ref(
        self,
        *,
        sample_id: str,
        sample_payload: tuple[bytes, str | None],
        upload_record: Mapping[str, Any] | None = None,
    ) -> str:
        upload_ref = str((upload_record or {}).get("upload_ref") or "").strip()
        updated_at = (upload_record or {}).get("updated_at")
        if upload_ref and isinstance(updated_at, datetime):
            timestamp = updated_at if updated_at.tzinfo is not None else updated_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - timestamp.astimezone(timezone.utc) <= timedelta(hours=24):
                try:
                    return str(getattr(await self.get_file_ref(upload_ref), "uri", upload_ref))
                except Exception:
                    pass
        upload_ref = str((await self.upload_samples({sample_id: sample_payload}))[sample_id]).strip()
        if self.sample_uploads_repository is not None:
            self.sample_uploads_repository.upsert_sample_upload(
                sample_id=sample_id,
                model_family=self.model_family,
                upload_ref=upload_ref,
            )
        return str(getattr(await self.get_file_ref(upload_ref), "uri", upload_ref))

    def _content_preview(self, contents: list, max_chars: int = 2000) -> str:
        content_text = "\n".join(
            item.model_dump_json(exclude_none=True)
            if hasattr(item, "model_dump_json")
            else str(item)
            for item in contents
        )
        return content_text[:max_chars]

    def _serialize_model_object(self, item: object) -> Any:
        if hasattr(item, "model_dump_json"):
            return json.loads(item.model_dump_json(exclude_none=True))
        if hasattr(item, "model_dump"):
            return item.model_dump(exclude_none=True)
        return item

    async def create_cache(self, contents: list, ttl: str) -> object:
        if self.cache_registry_path is None:
            raise ValueError("cache_registry_path is required to create cached content")

        cache_registry: dict[str, object]
        if self.cache_registry_path.exists():
            cache_registry = json.loads(self.cache_registry_path.read_text(encoding="utf-8"))
        else:
            cache_registry = {"entries": []}
        if not isinstance(cache_registry, dict):
            raise TypeError(
                f"Expected cache registry at {self.cache_registry_path} to contain a JSON object"
            )

        entries = cache_registry.setdefault("entries", [])
        cached_content = await asyncio.to_thread(
            self.client.caches.create,
            model=self.model_spec,
            config=types.CreateCachedContentConfig(
                display_name=(f"{self.config.workflow_name}_{self.config.stage}"),
                contents=contents,
                ttl=ttl,
            ),
        )
        entries.append(
            {
                "cache_name": getattr(cached_content, "name"),
                "model": self.model_spec,
                "workflow_name": self.config.workflow_name,
                "stage": self.config.stage,
                "image_dir": str(self.image_dir),
                "ttl": ttl,
                "content_preview": self._content_preview(contents),
                "status": "active",
            }
        )
        self.cache_registry_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_registry_path.write_text(
            json.dumps(cache_registry, indent=2),
            encoding="utf-8",
        )
        return cached_content

    async def retrieve_cache(self, cache_name: str) -> object:
        return await asyncio.to_thread(
            self.client.caches.get,
            name=cache_name,
        )

    async def transcribe(self, contents: list, cached_content: str | None = None) -> str:
        config_options = {"temperature": 0}
        if cached_content:
            config_options["cached_content"] = cached_content
        config = types.GenerateContentConfig(**config_options)
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model_spec,
            contents=contents,
            config=config,
        )
        return response.text or ""
