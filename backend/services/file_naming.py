from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class SampleName:
    document_id: str | None
    page: str


def file_stem(name: str) -> str:
    return re.sub(r"\.[^./]+$", "", str(name or "").strip())


def parse_sample_name(name: str) -> SampleName:
    normalized = file_stem(name)
    if normalized.startswith("_"):
        page = normalized[1:]
        if not page or "_" in page:
            raise ValueError("Documentless pages must use _<page>")
        return SampleName(document_id=None, page=page)

    if normalized.count("_") != 1:
        raise ValueError("Pages must use <document>_<page> or _<page>")
    document_id, page = normalized.split("_", 1)
    if not document_id or not page:
        raise ValueError("Pages must use <document>_<page> or _<page>")
    return SampleName(document_id=document_id, page=page)


def validate_document_name(name: str) -> str:
    normalized = file_stem(name)
    if not normalized:
        raise ValueError("Document name is required")
    if "_" in normalized:
        raise ValueError("Document names cannot contain underscores")
    return normalized


def matching_sample_ids(
    derivative_name: str,
    sample_rows: list[dict[str, object]],
) -> list[str]:
    normalized = file_stem(derivative_name)
    matches = [
        str(row["id"])
        for row in sample_rows
        if normalized.startswith(f"{str(row.get('name') or '')}_")
    ]
    return list(dict.fromkeys(matches))


def natural_sort_key(value: str) -> tuple[tuple[int, object], ...]:
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in re.split(r"(\d+)", str(value))
        if part
    )
