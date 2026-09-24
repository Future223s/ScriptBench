from __future__ import annotations

from difflib import SequenceMatcher
import re
from typing import Any

CONTEXT_WORDS = 3
MAX_CONTEXT_CHARS = 280
MAX_EDIT_PREVIEW_CHARS = 120
MAX_LEVENSHTEIN_CELLS = 2_000_000
PLACEHOLDER_PATTERN = re.compile(r"\[(?:unclear line|illegible)\]", re.IGNORECASE)


def _move_words_left(text: str, position: int, count: int) -> int:
    cursor = position
    for _ in range(count):
        while cursor > 0 and text[cursor - 1].isspace():
            cursor -= 1
        while cursor > 0 and not text[cursor - 1].isspace():
            cursor -= 1
    return cursor


def _move_words_right(text: str, position: int, count: int) -> int:
    cursor = position
    for _ in range(count):
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1
        while cursor < len(text) and not text[cursor].isspace():
            cursor += 1
    return cursor


def _word_window_context(text: str, start: int, end: int) -> tuple[str, int, int]:
    """Bound context around an edit to nearby whitespace-delimited words."""
    edit_preview_end = min(end, start + MAX_EDIT_PREVIEW_CHARS)
    window_start = _move_words_left(text, start, CONTEXT_WORDS)
    window_end = _move_words_right(text, edit_preview_end, CONTEXT_WORDS)
    if window_end - window_start > MAX_CONTEXT_CHARS:
        window_end = min(len(text), window_start + MAX_CONTEXT_CHARS)

    prefix = "… " if window_start > 0 else ""
    suffix = " …" if window_end < len(text) or edit_preview_end < end else ""
    context = f"{prefix}{text[window_start:window_end]}{suffix}"
    span_start = len(prefix) + start - window_start
    span_end = len(prefix) + edit_preview_end - window_start
    return context, span_start, max(span_start, span_end)


def _is_degenerate_placeholder_output(text: str) -> bool:
    matches = PLACEHOLDER_PATTERN.findall(text)
    if len(matches) < 20:
        return False
    compact_length = len("".join(text.split()))
    placeholder_length = sum(len(match) for match in matches)
    return compact_length > 0 and placeholder_length / compact_length >= 0.75


def _opcodes(source_text: str, target_text: str):
    if _is_degenerate_placeholder_output(source_text) or _is_degenerate_placeholder_output(target_text):
        if source_text == target_text:
            return [("equal", 0, len(source_text), 0, len(target_text))]
        tag = "insert" if not source_text else "delete" if not target_text else "replace"
        return [(tag, 0, len(source_text), 0, len(target_text))]
    return SequenceMatcher(a=source_text, b=target_text, autojunk=False).get_opcodes()


def _levenshtein_distance(source: str, target: str) -> int | None:
    """Return exact distance when bounded; avoid quadratic work on runaway output."""
    if source == target:
        return 0
    if not source:
        return len(target)
    if not target:
        return len(source)
    if len(source) * len(target) > MAX_LEVENSHTEIN_CELLS:
        return None
    if len(source) > len(target):
        source, target = target, source
    previous = list(range(len(source) + 1))
    for target_index, target_character in enumerate(target, start=1):
        current = [target_index]
        for source_index, source_character in enumerate(source, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[source_index] + 1,
                    previous[source_index - 1]
                    + (source_character != target_character),
                )
            )
        previous = current
    return previous[-1]


def classify_correctness(
    source: str,
    target: str,
    *,
    ground_truth: str | None,
    source_cer: float | None,
    target_cer: float | None,
) -> str:
    if ground_truth is None:
        return "unresolved"
    if "".join(source.split()).casefold() == "".join(target.split()).casefold():
        return "equivalent"
    if source_cer is None or target_cer is None:
        return "unresolved"
    if target_cer < source_cer:
        return "correction"
    if target_cer > source_cer:
        return "regression"
    return "neutral"


def build_disagreements(
    source_text: str,
    target_text: str,
    *,
    ground_truth: str | None = None,
    correctness_outcome: str | None = None,
) -> list[dict[str, Any]]:
    """Return localized, stable character-level disagreements for one direction."""
    source_text = source_text or ""
    target_text = target_text or ""
    correctness_outcome = correctness_outcome or classify_correctness(
        source_text,
        target_text,
        ground_truth=ground_truth,
        source_cer=None,
        target_cer=None,
    )
    result: list[dict[str, Any]] = []
    for index, (tag, source_start, source_end, target_start, target_end) in enumerate(
        _opcodes(source_text, target_text)
    ):
        if tag == "equal":
            continue
        source_context, source_span_start, source_span_end = _word_window_context(
            source_text, source_start, source_end
        )
        target_context, target_span_start, target_span_end = _word_window_context(
            target_text, target_start, target_end
        )
        result.append(
            {
                "sequence": index,
                "source_text": source_text[source_start:source_end],
                "target_text": target_text[target_start:target_end],
                "source_line_context": source_context,
                "target_line_context": target_context,
                "source_span_start": source_span_start,
                "source_span_end": source_span_end,
                "target_span_start": target_span_start,
                "target_span_end": target_span_end,
                "operation_type": {
                    "insert": "insertion",
                    "delete": "deletion",
                    "replace": "substitution",
                }[tag],
                "correctness_outcome": correctness_outcome,
            }
        )
    return result


def average_disagreement_count(counts: list[int]) -> float | None:
    return sum(counts) / len(counts) if counts else None


def find_disagreement_regions(
    source_text: str,
    target_text: str,
    *,
    agreement_anchor_length: int = 4,
    severity_threshold: float = 0.2,
    minimum_raw_edits: int = 1,
    correctness_outcome: str = "unresolved",
) -> list[dict[str, Any]]:
    """Group unstable alignment intervals between sufficiently strong anchors."""
    if agreement_anchor_length < 1:
        raise ValueError("agreement_anchor_length must be at least 1")
    if not 0 <= severity_threshold <= 1:
        raise ValueError("severity_threshold must be between 0 and 1")
    if minimum_raw_edits < 1:
        raise ValueError("minimum_raw_edits must be at least 1")

    source_text = source_text or ""
    target_text = target_text or ""
    opcodes = list(_opcodes(source_text, target_text))
    regions: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def finish(region: dict[str, Any]) -> None:
        source_start = region["source_start"]
        source_end = region["source_end"]
        target_start = region["target_start"]
        target_end = region["target_end"]
        source_region = source_text[source_start:source_end]
        target_region = target_text[target_start:target_end]
        exact_distance = _levenshtein_distance(source_region, target_region)
        raw_edit_count = (
            exact_distance
            if exact_distance is not None
            else int(region["raw_edit_count"])
        )
        denominator = max(len(source_region), len(target_region), 1)
        normalized_distance = raw_edit_count / denominator
        if (
            normalized_distance < severity_threshold
            and raw_edit_count < minimum_raw_edits
        ):
            return
        operation_type = (
            "insertion"
            if not source_region
            else "deletion"
            if not target_region
            else "substitution"
        )
        regions.append(
            {
                "sequence": len(regions),
                "source_start": source_start,
                "source_end": source_end,
                "target_start": target_start,
                "target_end": target_end,
                "source_text": source_region,
                "target_text": target_region,
                "raw_edit_count": raw_edit_count,
                "normalized_distance": normalized_distance,
                "operation_type": operation_type,
                "correctness_outcome": correctness_outcome,
            }
        )

    for tag, source_start, source_end, target_start, target_end in opcodes:
        if tag == "equal":
            match_length = source_end - source_start
            if current is not None and match_length >= agreement_anchor_length:
                finish(current)
                current = None
            elif current is not None:
                current["source_end"] = source_end
                current["target_end"] = target_end
            continue

        edit_count = max(source_end - source_start, target_end - target_start)
        if current is None:
            current = {
                "source_start": source_start,
                "source_end": source_end,
                "target_start": target_start,
                "target_end": target_end,
                "raw_edit_count": edit_count,
            }
        else:
            current["source_end"] = source_end
            current["target_end"] = target_end
            current["raw_edit_count"] += edit_count

    if current is not None:
        finish(current)
    return regions
