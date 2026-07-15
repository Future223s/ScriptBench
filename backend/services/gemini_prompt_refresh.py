from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any
from backend.database.repositories.sample_uploads_repository import SampleUploadsRepository
from backend.services.gemini import GeminiClient
from backend.services.prompt_resolution import PLACEHOLDER_URI_PREFIX


class GeminiPromptRefreshService:
    def __init__(
        self,
        *,
        provider: GeminiClient,
        sample_uploads_repository: SampleUploadsRepository,
        freshness_window_hours: int = 24,
    ) -> None:
        self.provider = provider
        self.sample_uploads_repository = sample_uploads_repository
        self.freshness_window = timedelta(hours=freshness_window_hours)

    async def refresh_resolved_prompt(
        self,
        *,
        resolved_prompt: Mapping[str, Any],
        sample_payloads_by_sample_id: Mapping[str, tuple[bytes, str | None]],
    ) -> dict[str, Any]:
        sample_ids = self._collect_sample_ids(resolved_prompt)
        upload_records = self.sample_uploads_repository.get_sample_upload_records(
            sample_ids,
            self.provider.model_family,
        )

        refreshed_file_uris: dict[str, str] = {}
        for sample_id in sample_ids:
            sample_payload = sample_payloads_by_sample_id.get(sample_id)
            if sample_payload is None:
                raise KeyError(f"Missing sample payload for: {sample_id}")

            upload_ref, file_ref, uploaded = await self._ensure_fresh_upload_ref(
                sample_id=sample_id,
                sample_payload=sample_payload,
                upload_record=upload_records.get(sample_id),
            )
            refreshed_file_uris[sample_id] = str(getattr(file_ref, "uri", upload_ref))
            if uploaded:
                self.sample_uploads_repository.upsert_sample_upload(
                    sample_id=sample_id,
                    model_family=self.provider.model_family,
                    upload_ref=upload_ref,
                )

        refreshed_prompt = self._patch_prompt(
            dict(resolved_prompt),
            refreshed_file_uris=refreshed_file_uris,
            sample_payloads_by_sample_id=sample_payloads_by_sample_id,
        )
        return {
            "resolved_prompt": refreshed_prompt,
            "sample_ids": sample_ids,
            "refreshed_file_uris": refreshed_file_uris,
        }

    async def _ensure_fresh_upload_ref(
        self,
        *,
        sample_id: str,
        sample_payload: tuple[bytes, str | None],
        upload_record: Mapping[str, Any] | None,
    ) -> tuple[str, Any, bool]:
        if upload_record is not None and self._is_fresh(upload_record.get("updated_at")):
            upload_ref = str(upload_record.get("upload_ref", "")).strip()
            if upload_ref:
                try:
                    file_ref = await self.provider.get_file_ref(upload_ref)
                    return upload_ref, file_ref, False
                except Exception:
                    pass

        uploaded_refs = await self.provider.upload_samples({sample_id: sample_payload})
        upload_ref = str(uploaded_refs[sample_id]).strip()
        if not upload_ref:
            raise RuntimeError(f"Gemini did not return an upload ref for {sample_id}")
        file_ref = await self.provider.get_file_ref(upload_ref)
        return upload_ref, file_ref, True

    def _collect_sample_ids(self, resolved_prompt: Mapping[str, Any]) -> list[str]:
        prompt_file_bindings = resolved_prompt.get("prompt_file_bindings", [])
        if isinstance(prompt_file_bindings, list):
            sample_ids = [
                str(binding.get("sample_id", "")).strip()
                for binding in prompt_file_bindings
                if isinstance(binding, Mapping) and str(binding.get("sample_id", "")).strip()
            ]
            if sample_ids:
                return list(dict.fromkeys(sample_ids))

        contents = resolved_prompt.get("contents", [])
        if not isinstance(contents, list):
            return []

        sample_ids: list[str] = []
        for content in contents:
            if not isinstance(content, Mapping):
                continue
            parts = content.get("parts", [])
            if not isinstance(parts, list):
                continue
            for part in parts:
                if not isinstance(part, Mapping):
                    continue
                file_data = part.get("file_data")
                if not isinstance(file_data, Mapping):
                    continue
                sample_id = str(file_data.get("sample_id", "")).strip()
                file_uri = str(file_data.get("file_uri", "")).strip()
                if not sample_id and file_uri.startswith(PLACEHOLDER_URI_PREFIX):
                    sample_id = file_uri.removeprefix(PLACEHOLDER_URI_PREFIX).strip()
                if sample_id:
                    sample_ids.append(sample_id)
        return list(dict.fromkeys(sample_ids))

    def _patch_prompt(
        self,
        resolved_prompt: dict[str, Any],
        *,
        refreshed_file_uris: Mapping[str, str],
        sample_payloads_by_sample_id: Mapping[str, tuple[bytes, str | None]],
    ) -> dict[str, Any]:
        contents = resolved_prompt.get("contents", [])
        if not isinstance(contents, list):
            return resolved_prompt

        for content in contents:
            if not isinstance(content, dict):
                continue
            parts = content.get("parts", [])
            if not isinstance(parts, list):
                continue
            for part in parts:
                if not isinstance(part, dict):
                    continue
                file_data = part.get("file_data")
                if not isinstance(file_data, dict):
                    continue
                sample_id = str(file_data.get("sample_id", "")).strip()
                if not sample_id and str(file_data.get("file_uri", "")).startswith(PLACEHOLDER_URI_PREFIX):
                    sample_id = str(file_data["file_uri"]).removeprefix(PLACEHOLDER_URI_PREFIX).strip()
                if not sample_id:
                    continue
                file_data["file_uri"] = refreshed_file_uris[sample_id]
                file_data["mime_type"] = sample_payloads_by_sample_id[sample_id][1]
                file_data["placeholder"] = False
        return resolved_prompt

    def _is_fresh(self, updated_at: Any) -> bool:
        if not isinstance(updated_at, datetime):
            return False
        timestamp = updated_at if updated_at.tzinfo is not None else updated_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - timestamp.astimezone(timezone.utc) <= self.freshness_window
