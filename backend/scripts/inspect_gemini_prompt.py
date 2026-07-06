from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.api.dependencies import get_engine, row_to_dict
from backend.core.workflow_config import WorkflowConfig
from backend.database.repositories.sample_uploads_repository import SampleUploadsRepository
from backend.database.repositories.transcription_job_samples_repository import (
    TranscriptionJobSamplesRepository,
)
from backend.database.repositories.transcription_jobs_repository import (
    TranscriptionJobsRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.prompt_spec import PromptSpec
from backend.services.gemini import GeminiClient


MISSING_FILE_MARKER = "missing_or_inaccessible"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Inspect an existing transcription job and print the Gemini file-store "
            "records that back each prompt file link."
        ),
    )
    parser.add_argument(
        "--job-id",
        type=int,
        required=True,
        help="Transcription job ID to inspect.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a JSON report instead of a human-readable summary.",
    )
    return parser.parse_args()


def _unique_preserve_order(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if str(value).strip()))


def _serialize_model_object(item: object) -> Any:
    if hasattr(item, "model_dump_json"):
        return json.loads(item.model_dump_json(exclude_none=True))
    if hasattr(item, "model_dump"):
        return item.model_dump(exclude_none=True)
    return item


def _load_json_value(value: object) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def _extract_prompt_file_uris(resolved_prompt: Any) -> list[str]:
    if not isinstance(resolved_prompt, dict):
        return []

    contents = resolved_prompt.get("contents", [])
    if not isinstance(contents, list):
        return []

    file_uris: list[str] = []
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
            file_uri = file_data.get("file_uri")
            if file_uri is not None:
                file_uris.append(str(file_uri))
    return file_uris


async def _build_report(job_id: int) -> dict[str, Any]:
    engine = get_engine()
    transcription_jobs_repository = TranscriptionJobsRepository(engine)
    transcription_job_samples_repository = TranscriptionJobSamplesRepository(engine)
    workflows_repository = WorkflowsRepository(engine)
    sample_uploads_repository = SampleUploadsRepository(engine)

    job_row = transcription_jobs_repository.fetch_transcription_job(job_id)
    if job_row is None:
        raise SystemExit(f"Transcription job not found: {job_id}")

    workflow_id = int(job_row["workflow_id"])
    workflow_row = workflows_repository.fetch_workflow(workflow_id)
    if workflow_row is None:
        raise SystemExit(f"Workflow not found for job {job_id}: {workflow_id}")

    prompt_spec = PromptSpec.model_validate(_load_json_value(workflow_row["prompt_spec"]))
    sample_ids = [
        str(sample_id).strip()
        for sample_id in transcription_job_samples_repository.fetch_transcription_job_samples(job_id)
        if str(sample_id).strip()
    ]
    example_asset_ids = [
        str(asset_id).strip()
        for example in prompt_spec.examples
        for asset_id in example.assets
        if str(asset_id).strip()
    ]
    required_sample_ids = _unique_preserve_order([*example_asset_ids, *sample_ids])

    upload_refs = sample_uploads_repository.get_sample_upload_refs(
        required_sample_ids,
        str(workflow_row["model_family"]),
    )
    missing_upload_ids = [
        sample_id for sample_id in required_sample_ids if sample_id not in upload_refs
    ]
    if missing_upload_ids:
        raise SystemExit(
            "Missing stored Gemini upload refs for: " + ", ".join(missing_upload_ids)
        )

    workflow_config = WorkflowConfig(
        workflow_name=str(workflow_row["workflow_name"]),
        stage=str(workflow_row["workflow_stage"]),
        model_family=str(workflow_row["model_family"]),
        model=str(workflow_row["model"]) if workflow_row["model"] is not None else None,
        workflow_id=workflow_id,
        status=str(workflow_row["status"]),
        prompt_template=workflow_row["prompt_spec"],
    )
    gemini_client = GeminiClient(workflow_config=workflow_config, image_dir=Path("."))

    resolved_prompt = _load_json_value(job_row["resolved_prompt"])
    prompt_file_uris = _extract_prompt_file_uris(resolved_prompt)

    rows: list[dict[str, Any]] = []
    for index, sample_id in enumerate(required_sample_ids):
        prompt_uri = prompt_file_uris[index] if index < len(prompt_file_uris) else None
        file_ref_payload: dict[str, Any] | None = None
        file_error: str | None = None

        try:
            file_ref = await gemini_client._get_file_ref(upload_refs[sample_id])
            file_ref_payload = _serialize_model_object(file_ref)
        except Exception as exc:  # Gemini returns 403/404 for missing or inaccessible files
            file_error = f"{type(exc).__name__}: {exc}"

        file_uri = file_ref_payload.get("uri") if isinstance(file_ref_payload, dict) else None
        display_name = (
            file_ref_payload.get("display_name")
            if isinstance(file_ref_payload, dict)
            else None
        )
        name = file_ref_payload.get("name") if isinstance(file_ref_payload, dict) else None

        rows.append(
            {
                "index": index + 1,
                "sample_id": sample_id,
                "upload_ref": upload_refs[sample_id],
                "file_store": file_ref_payload,
                "file_error": file_error,
                "file_state": "found" if file_ref_payload is not None else MISSING_FILE_MARKER,
                "prompt_uri": prompt_uri,
                "uri_matches": prompt_uri == file_uri,
                "name_matches_upload_ref": name == upload_refs[sample_id],
                "display_name_matches_sample_id": display_name == sample_id,
            }
        )

    return {
        "job": row_to_dict(job_row),
        "workflow": row_to_dict(workflow_row),
        "required_sample_ids": required_sample_ids,
        "example_asset_ids": example_asset_ids,
        "sample_ids": sample_ids,
        "prompt_file_uris": prompt_file_uris,
        "files": rows,
    }


def _print_human_report(report: dict[str, Any]) -> None:
    job = report["job"]
    workflow = report["workflow"]
    files = report["files"]

    print(f"Job {job.get('job_id')} / Workflow {workflow.get('workflow_id')}")
    print(
        f"Workflow: {workflow.get('workflow_name')} | Stage: {workflow.get('workflow_stage')} "
        f"| Model family: {workflow.get('model_family')}"
    )
    print(f"Prompt file links: {len(report.get('prompt_file_uris', []))}")
    print("")
    for row in files:
        file_store = row.get("file_store", {})
        print(f"[{row['index']}] {row['sample_id']}")
        print(f"  upload_ref: {row['upload_ref']}")
        print(f"  file_state: {row['file_state']}")
        if row.get("file_error"):
            print(f"  file_error: {row['file_error']}")
        print(f"  file.name: {file_store.get('name')}")
        print(f"  file.display_name: {file_store.get('display_name')}")
        print(f"  file.uri: {file_store.get('uri')}")
        print(f"  prompt_uri: {row['prompt_uri']}")
        print(f"  uri_matches: {row['uri_matches']}")
        print(f"  name_matches_upload_ref: {row['name_matches_upload_ref']}")
        print(f"  display_name_matches_sample_id: {row['display_name_matches_sample_id']}")
        print("")


def main() -> int:
    args = parse_args()
    report = asyncio.run(_build_report(args.job_id))

    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        _print_human_report(report)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
