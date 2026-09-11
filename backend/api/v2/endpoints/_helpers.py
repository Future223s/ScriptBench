from __future__ import annotations

from typing import Any

from backend.api.dependencies import row_to_dict


def row_payload_with_blob_metadata(
    row: Any,
    *,
    blob_key: str = "blob",
    include_blob: bool = False,
) -> dict[str, object]:
    payload = row_to_dict(row, exclude={blob_key})
    blob = row[blob_key]
    payload["has_blob"] = blob is not None
    payload["blob_size"] = len(blob) if blob is not None else 0
    if include_blob:
        payload["blob_base64"] = row_to_dict({blob_key: blob})[blob_key]
    return payload
