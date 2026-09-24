from __future__ import annotations

import json
from copy import deepcopy
from typing import Any


def inject_output_contract(
    payload: dict[str, Any],
    *,
    model_family: str,
    output_spec: dict[str, Any],
    output_refs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Append the runtime-owned JSON response contract to a model payload."""
    entity_ids = [str(ref["entity_id"]) for ref in output_refs]
    if not entity_ids:
        raise ValueError("Execution job has no output entity IDs")

    value_rule = (
        "Each value must conform to this item shape: "
        + json.dumps(output_spec["item_schema"], sort_keys=True)
    )
    extra_instructions = str(output_spec.get("instructions") or "").strip()
    instruction = "\n".join(
        part
        for part in [
            "Return only one valid JSON object. Do not use Markdown fences or add commentary.",
            f"The object must contain exactly these keys: {json.dumps(entity_ids)}.",
            value_rule,
            extra_instructions,
        ]
        if part
    )

    rendered = deepcopy(payload)
    rendered["_scriptbench_output_contract"] = {"entity_ids": entity_ids}
    if model_family == "gemini":
        contents = rendered.setdefault("contents", [])
        if not contents:
            contents.append({"role": "user", "parts": []})
        contents[-1].setdefault("parts", []).append({"text": instruction})
    elif model_family == "anthropic":
        messages = rendered.setdefault("messages", [])
        if not messages:
            messages.append({"role": "user", "content": []})
        content = messages[-1].get("content")
        if isinstance(content, list):
            content.append({"type": "text", "text": instruction})
        else:
            messages[-1]["content"] = (
                f"{content}\n\n{instruction}" if content else instruction
            )
    else:
        raise ValueError(f"Unsupported model family: {model_family}")
    return rendered
