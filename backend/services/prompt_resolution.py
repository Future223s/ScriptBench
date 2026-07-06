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
