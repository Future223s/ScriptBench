from __future__ import annotations

import asyncio
import json
import os
from io import BytesIO
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


class GeminiClient(TranscriptionEngine):
    def __init__(
        self,
        workflow_config: WorkflowConfig,
        image_dir: Path | None = None,
        cache_registry_path: Path | None = None,
        image_extensions: tuple[str, ...] = DEFAULT_IMAGE_EXTENSIONS,
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

    async def build_prompt(
        self,
        *,
        prompt_spec: Mapping[str, Any],
        sample_payloads_by_sample_id: Mapping[str, tuple[bytes, str | None]],
        sample_ids: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        instructions = str(prompt_spec["instructions"]).strip()
        if not instructions:
            raise ValueError("prompt_spec.instructions is required")
        if not sample_ids:
            raise ValueError("sample_ids is required")

        examples = prompt_spec["examples"]
        output_format = prompt_spec["output_format"]
        resolved_sample_ids = [str(sample_id) for sample_id in sample_ids]
        required_sample_ids = list(
            dict.fromkeys(
                [
                    *(str(asset_id) for example in examples for asset_id in example["assets"]),
                    *resolved_sample_ids,
                ]
            )
        )
        missing_sample_ids = [sample_id for sample_id in required_sample_ids if sample_id not in sample_payloads_by_sample_id]
        if missing_sample_ids:
            raise KeyError(f"Missing sample payload(s) for: {', '.join(missing_sample_ids)}")

        upload_refs = await self.upload_samples({sample_id: sample_payloads_by_sample_id[sample_id] for sample_id in required_sample_ids})
        file_refs = await self.get_file_refs(upload_refs)

        contents: list[types.Content] = [types.Content(role="user", parts=[types.Part.from_text(text=instructions)])]

        for example_index, example in enumerate(examples, start=1):
            title = str(example["title"]).strip()
            instruction_text = str(example["instruction_text"]).strip()
            asset_ids = [str(asset_id) for asset_id in example["assets"]]
            example_file_refs = [file_refs[asset_id] for asset_id in asset_ids]
            parts = [types.Part.from_text(text=f"{title}\n{instruction_text}".strip())]
            parts.extend(types.Part.from_uri(file_uri=getattr(file_ref, "uri"), mime_type=getattr(file_ref, "mime_type", None)) for file_ref in example_file_refs)
            contents.append(types.Content(role="user", parts=parts))

        for sample_index, sample_id in enumerate(resolved_sample_ids, start=1):
            file_ref = file_refs[sample_id]
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=f"sample_{sample_index}"), types.Part.from_uri(file_uri=getattr(file_ref, "uri"), mime_type=getattr(file_ref, "mime_type", None))]))

        output_text = (
            "Return plain text only."
            if str(output_format["type"]).strip() == "plain_text"
            else "Return output in this format: " + json.dumps(dict(output_format), separators=(",", ":"))
        )
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=output_text)]))

        return {
            "contents": contents,
            "resolved_prompt": {
                "contents": [self._serialize_model_object(content) for content in contents],
            },
        }

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
