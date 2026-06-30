from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen


DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_GROUPING_NAME = "EMMO Sample"
LINE_CROP_PATTERN = re.compile(r"^(?P<prefix>.+?)_line_(?P<line>.+)$")


@dataclass(frozen=True)
class GroupAssignment:
    value: str
    sample_ids: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Assign line-crop grouping values from sample IDs.",
    )
    parser.add_argument(
        "--api-base-url",
        default=DEFAULT_API_BASE_URL,
        help=f"Backend base URL (default: {DEFAULT_API_BASE_URL})",
    )
    parser.add_argument(
        "--grouping-name",
        default=DEFAULT_GROUPING_NAME,
        help=f"Grouping name to populate (default: {DEFAULT_GROUPING_NAME})",
    )
    parser.add_argument(
        "--sample-query",
        default=None,
        help="Optional backend sample query to narrow the scan.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned assignments without sending them to the API.",
    )
    return parser.parse_args()


def api_get_json(api_base_url: str, path: str, query: dict[str, Any] | None = None) -> dict[str, Any]:
    url = urljoin(api_base_url.rstrip("/") + "/", path.lstrip("/"))
    if query:
        url = f"{url}?{urlencode(query)}"
    with urlopen(url) as response:
        return json.load(response)


def api_post_json(api_base_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = urljoin(api_base_url.rstrip("/") + "/", path.lstrip("/"))
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urlopen(request) as response:
        return json.load(response)


def derive_group_value(sample_id: str) -> str | None:
    match = LINE_CROP_PATTERN.match(sample_id)
    if not match:
        return None

    prefix = match.group("prefix")
    return prefix.replace("_1r_", "_1v_", 1).strip() or None


def collect_assignments(samples: list[dict[str, Any]]) -> list[GroupAssignment]:
    grouped_sample_ids: dict[str, list[str]] = defaultdict(list)
    for sample in samples:
        sample_id = str(sample.get("sample_id", "")).strip()
        if not sample_id:
            continue
        group_value = derive_group_value(sample_id)
        if group_value is None:
            continue
        grouped_sample_ids[group_value].append(sample_id)

    return [
        GroupAssignment(value=group_value, sample_ids=sample_ids)
        for group_value, sample_ids in sorted(grouped_sample_ids.items())
    ]


def main() -> int:
    args = parse_args()
    query = {"query": args.sample_query} if args.sample_query else None
    samples_response = api_get_json(args.api_base_url, "/api/samples", query=query)
    samples = samples_response.get("samples", [])
    if not isinstance(samples, list):
        raise SystemExit("Unexpected /api/samples response shape")

    assignments = collect_assignments(samples)
    if not assignments:
        print("No line-crop samples matched the grouping rule.")
        return 0

    print(f"Found {sum(len(item.sample_ids) for item in assignments)} samples across {len(assignments)} group values.")
    for assignment in assignments:
        print(f"- {assignment.value}: {len(assignment.sample_ids)} sample(s)")

    if args.dry_run:
        print("Dry run requested; no API updates were sent.")
        return 0

    for assignment in assignments:
        payload = {"value": assignment.value, "sample_ids": assignment.sample_ids}
        response = api_post_json(
            args.api_base_url,
            f"/api/groupings/{quote(args.grouping_name, safe='')}/values",
            payload,
        )
        print(
            f"Updated {response.get('name', args.grouping_name)} = {assignment.value} "
            f"for {len(assignment.sample_ids)} sample(s)."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
