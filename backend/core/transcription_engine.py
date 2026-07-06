from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable, Mapping, Sequence
from pathlib import Path

from backend.core.workflow_config import WorkflowConfig

DEFAULT_IMAGE_EXTENSIONS: tuple[str, ...] = (
    ".png",
    ".jpg",
    ".jpeg",
    ".tif",
    ".tiff",
    ".webp",
)

SamplePayload = tuple[bytes, str | None]


class TranscriptionEngine(ABC):
    def __init__(
        self,
        workflow_config: WorkflowConfig,
        image_dir: Path,
        image_extensions: Sequence[str] = DEFAULT_IMAGE_EXTENSIONS,
    ) -> None:
        self.config = workflow_config
        self.image_dir = image_dir
        self.image_extensions = tuple(image_extensions)
        self.model_family = workflow_config.model_family

    def resolve_image_path(
        self,
        sample_id: str,
        extensions: Sequence[str] | None = None,
    ) -> Path:
        if not self.image_dir.exists():
            raise FileNotFoundError(f"Missing image directory: {self.image_dir}")

        allowed_extensions = tuple(
            extension.lower() for extension in (extensions or self.image_extensions)
        )
        matches = [
            path
            for path in self.image_dir.iterdir()
            if path.is_file()
            and path.stem == sample_id
            and path.suffix.lower() in allowed_extensions
        ]
        if not matches:
            allowed = ", ".join(allowed_extensions)
            raise FileNotFoundError(
                f"Could not find image for sample '{sample_id}' in {self.image_dir}. "
                f"Allowed extensions: {allowed}"
            )

        matches.sort(key=lambda path: allowed_extensions.index(path.suffix.lower()))
        return matches[0]

    @abstractmethod
    async def _upload_sample(
        self,
        sample_id: str,
        sample_blob: bytes,
        sample_mime_type: str | None,
    ) -> object:
        ...

    async def upload_samples(
        self,
        sample_payloads: Mapping[str, SamplePayload],
        existing_upload_refs: Mapping[str, str] | None = None,
        batch_size: int = 50,
    ) -> dict[str, str]:
        upload_refs: dict[str, str] = {}
        batch_counter = 0
        cached_refs = dict(existing_upload_refs or {})
        for sample_id, payload in sample_payloads.items():
            existing_ref = cached_refs.get(sample_id)
            if existing_ref is not None:
                upload_refs[sample_id] = existing_ref
                continue

            sample_blob, sample_mime_type = payload
            uploaded_ref = await self._upload_sample(
                sample_id=sample_id,
                sample_blob=sample_blob,
                sample_mime_type=sample_mime_type,
            )
            upload_ref = getattr(uploaded_ref, "name", str(uploaded_ref))
            upload_refs[sample_id] = upload_ref
            batch_counter += 1
            if batch_counter % batch_size == 0:
                print(f"Saved {batch_counter} upload refs")

        return upload_refs

    @abstractmethod
    async def _get_file_ref(self, ref_name: str) -> object:
        ...

    async def get_file_ref(self, ref_name: str) -> object:
        return await self._get_file_ref(ref_name)

    async def get_file_refs(self, ref_names: Mapping[str, str]) -> dict[str, object]:
        file_refs: dict[str, object] = {}
        for sample_id, ref_name in ref_names.items():
            file_refs[sample_id] = await self._get_file_ref(ref_name)
        return file_refs

    @abstractmethod
    async def transcribe(self, contents: list, cached_content: str | None = None) -> str:
        ...

    async def transcribe_concurrently(
        self,
        sample_ids: Sequence[str],
        transcription_fn: Callable[[str], Awaitable[str]],
    ) -> dict[str, str]:
        tasks = {
            sample_id: asyncio.create_task(transcription_fn(sample_id))
            for sample_id in sample_ids
        }
        return {
            sample_id: await task
            for sample_id, task in tasks.items()
        }
