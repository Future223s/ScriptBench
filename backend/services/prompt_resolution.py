from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any


PLACEHOLDER_URI_PREFIX = "gemini-placeholder://"


class PromptResolutionService:
    async def resolve_prompt(
        self,
        *,
        prompt_spec: Mapping[str, Any],
        sample_ids: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        instructions = str(prompt_spec["instructions"]).strip()
        if not instructions:
            raise ValueError("prompt_spec.instructions is required")
        if not sample_ids:
            raise ValueError("sample_ids is required")

        examples = prompt_spec["examples"]
        output_format = prompt_spec["output_format"]
        resolved_sample_ids: list[str] = []
        for sample_id in sample_ids:
            sample_id_text = str(sample_id).strip()
            if sample_id_text:
                resolved_sample_ids.append(sample_id_text)
        if not resolved_sample_ids:
            raise ValueError("sample_ids is required")

        contents: list[dict[str, Any]] = [
            {"role": "user", "parts": [{"text": instructions}]},
        ]

        for example in examples:
            title = str(example["title"]).strip()
            instruction_text = str(example["instruction_text"]).strip()
            asset_ids: list[str] = []
            for asset_id in example["assets"]:
                asset_id_text = str(asset_id).strip()
                if asset_id_text:
                    asset_ids.append(asset_id_text)
            parts: list[dict[str, Any]] = [{"text": f"{title}\n{instruction_text}".strip()}]
            for asset_id in asset_ids:
                placeholder_uri = f"{PLACEHOLDER_URI_PREFIX}{asset_id}"
                parts.append(
                    {
                        "file_data": {
                            "file_uri": placeholder_uri,
                            "mime_type": None,
                            "sample_id": asset_id,
                        }
                    }
                )
            contents.append({"role": "user", "parts": parts})

        for sample_id in resolved_sample_ids:
            placeholder_uri = f"{PLACEHOLDER_URI_PREFIX}{sample_id}"
            contents.append(
                {
                    "role": "user",
                    "parts": [
                        {"text": sample_id},
                        {
                            "file_data": {
                                "file_uri": placeholder_uri,
                                "mime_type": None,
                                "sample_id": sample_id,
                            }
                        },
                    ],
                }
            )

        output_text = (
            "Return plain text only."
            if str(output_format["type"]).strip() == "plain_text"
            else "Return output in this format: "
            + json.dumps(dict(output_format), separators=(",", ":"))
        )
        contents.append({"role": "user", "parts": [{"text": output_text}]})

        return {
            "contents": contents,
            "resolved_prompt": {
                "contents": contents,
            },
        }

    async def refresh_resolved_prompt(
        self,
        *,
        resolved_prompt: Mapping[str, Any] | str,
        refreshed_file_uris: Mapping[str, str],
        sample_payloads_by_sample_id: Mapping[str, tuple[bytes, str | None]] | None = None,
    ) -> dict[str, Any]:
        if isinstance(resolved_prompt, str):
            resolved_prompt = json.loads(resolved_prompt)
        contents = resolved_prompt.get("contents", []) if isinstance(resolved_prompt, dict) else []
        for content in contents:
            if not isinstance(content, dict):
                continue
            for part in content.get("parts", []):
                if not isinstance(part, dict):
                    continue
                file_data = part.get("file_data")
                if not isinstance(file_data, dict):
                    continue
                sample_id = str(file_data.get("sample_id") or "").strip()
                if not sample_id:
                    file_uri = str(file_data.get("file_uri") or "")
                    if file_uri.startswith(PLACEHOLDER_URI_PREFIX):
                        sample_id = file_uri.removeprefix(PLACEHOLDER_URI_PREFIX).strip()
                if sample_id in refreshed_file_uris:
                    file_data["file_uri"] = refreshed_file_uris[sample_id]
                    if sample_payloads_by_sample_id and sample_id in sample_payloads_by_sample_id:
                        file_data["mime_type"] = sample_payloads_by_sample_id[sample_id][1]
        return resolved_prompt if isinstance(resolved_prompt, dict) else {"contents": contents}
