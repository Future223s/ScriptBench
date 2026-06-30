from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from google.genai import types

from backend.core.transcription_engine import TranscriptionEngine
from backend.core.workflow_config import WorkflowConfig
from backend.database.repositories.sample_uploads_repository import (
    SampleUploadsRepository,
)

class PromptResolutionService:
    def __init__(
        self,
        *,
        workflow_config: WorkflowConfig,
        provider: TranscriptionEngine,
        sample_uploads_repository: SampleUploadsRepository,
    ) -> None:
        self.workflow_config = workflow_config
        self.provider = provider
        self.sample_uploads_repository = sample_uploads_repository

    async def resolve_prompt(
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
        missing_sample_ids = [
            sample_id
            for sample_id in required_sample_ids
            if sample_id not in sample_payloads_by_sample_id
        ]
        if missing_sample_ids:
            raise KeyError(
                f"Missing sample payload(s) for: {', '.join(missing_sample_ids)}"
            )

        existing_upload_refs = self.sample_uploads_repository.get_sample_upload_refs(
            required_sample_ids,
            self.workflow_config.model_family,
        )
        upload_refs = await self.provider.upload_samples(
            {sample_id: sample_payloads_by_sample_id[sample_id] for sample_id in required_sample_ids},
            existing_upload_refs=existing_upload_refs,
        )
        for sample_id, upload_ref in upload_refs.items():
            self.sample_uploads_repository.upsert_sample_upload(
                sample_id=sample_id,
                model_family=self.workflow_config.model_family,
                upload_ref=upload_ref,
            )

        file_refs = await self.provider.get_file_refs(upload_refs)
        contents: list[types.Content] = [
            types.Content(role="user", parts=[types.Part.from_text(text=instructions)]),
        ]

        for example in examples:
            title = str(example["title"]).strip()
            instruction_text = str(example["instruction_text"]).strip()
            asset_ids = [str(asset_id) for asset_id in example["assets"]]
            example_file_refs = [file_refs[asset_id] for asset_id in asset_ids]
            parts = [types.Part.from_text(text=f"{title}\n{instruction_text}".strip())]
            parts.extend(
                types.Part.from_uri(
                    file_uri=getattr(file_ref, "uri"),
                    mime_type=getattr(file_ref, "mime_type", None),
                )
                for file_ref in example_file_refs
            )
            contents.append(types.Content(role="user", parts=parts))

        for sample_index, sample_id in enumerate(resolved_sample_ids, start=1):
            file_ref = file_refs[sample_id]
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=f"sample_{sample_index}"),
                        types.Part.from_uri(
                            file_uri=getattr(file_ref, "uri"),
                            mime_type=getattr(file_ref, "mime_type", None),
                        ),
                    ],
                )
            )

        output_text = (
            "Return plain text only."
            if str(output_format["type"]).strip() == "plain_text"
            else "Return output in this format: "
            + json.dumps(dict(output_format), separators=(",", ":"))
        )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=output_text)])
        )

        return {
            "contents": contents,
            "resolved_prompt": {
                "contents": [self._serialize_model_object(content) for content in contents],
            },
        }

    def _serialize_model_object(self, item: object) -> Any:
        if hasattr(item, "model_dump_json"):
            return json.loads(item.model_dump_json(exclude_none=True))
        if hasattr(item, "model_dump"):
            return item.model_dump(exclude_none=True)
        return item
