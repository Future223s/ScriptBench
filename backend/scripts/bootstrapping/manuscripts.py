from __future__ import annotations

import argparse
import mimetypes
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.engine import Connection, Engine

from backend.api.dependencies import get_engine
from backend.database.repositories.bootstrap_repository import BootstrapRepository
from backend.services.file_naming import parse_sample_name

EXPECTED_SAMPLE_COUNT = 19
DATASET_NAME = "Economic Upheaval"
DERIVATIVE_GROUP_NAME = "Line Crops"
SAMPLE_SET_NAME = "test"
SMOKE_OUTPUT_SPEC_NAME = "test"
LINE_CROP_PATTERN = re.compile(r"(?P<name>.+)_line_\d+$", re.IGNORECASE)
IMAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"})


@dataclass(frozen=True)
class SourceSample:
    sample_id: str
    image_path: Path
    ground_truth_path: Path


@dataclass(frozen=True)
class LineCrop:
    image_path: Path
    sample_id: str
    derivative_name: str


@dataclass(frozen=True)
class SeedResult:
    sample_count: int
    derivative_count: int
    sample_set_id: int
    derivative_group_id: int


def _image_files(directory: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        ),
        key=lambda path: path.name.casefold(),
    )


def _require_directory(path: Path, description: str) -> Path:
    if not path.is_dir():
        raise ValueError(f"Missing {description} directory: {path}")
    return path


def _canonical_emmo_sample_name(source_name: str) -> str:
    match = re.fullmatch(r"(?P<document>[^_]+)_(?P<page>[^_]+)_EMMO", source_name)
    if match is not None:
        return f"EMMO-{match.group('document')}_{match.group('page')}"
    if re.fullmatch(r"[^_]+_[^_]+", source_name) or re.fullmatch(r"_[^_]+", source_name):
        return source_name
    raise ValueError(f"Unexpected EMMO page filename: {source_name}")


def discover_dataset(
    emmo_root: Path, *, expected_sample_count: int
) -> tuple[list[SourceSample], list[LineCrop]]:
    emmo_root = _require_directory(emmo_root, "EMMO source")
    images_directory = _require_directory(emmo_root / "images", "source images")
    ground_truth_directory = _require_directory(
        emmo_root / "ground_truth_txt", "ground-truth"
    )
    crops_directory = next(
        (
            candidate
            for candidate in (
                emmo_root / "segementation_line_crops",
                emmo_root / "segmentation_line_crops",
            )
            if candidate.is_dir()
        ),
        None,
    )
    if crops_directory is None:
        raise ValueError(
            "Missing line-crop directory: expected "
            f"{emmo_root / 'segementation_line_crops'}"
        )

    image_by_stem = {path.stem: path for path in _image_files(images_directory)}
    crop_rows: list[LineCrop] = []
    source_sample_ids: set[str] = set()
    for crop_path in _image_files(crops_directory):
        match = LINE_CROP_PATTERN.fullmatch(crop_path.stem)
        if match is None:
            raise ValueError(
                f"Line-crop filename does not end in '_line_<number>': {crop_path.name}"
            )
        source_sample_id = match.group("name")
        sample_id = _canonical_emmo_sample_name(source_sample_id)
        source_sample_ids.add(sample_id)
        crop_rows.append(
            LineCrop(
                image_path=crop_path,
                sample_id=sample_id,
                derivative_name=f"{sample_id}{crop_path.stem[len(source_sample_id):]}",
            )
        )

    if len(source_sample_ids) != expected_sample_count:
        raise ValueError(
            f"Expected {expected_sample_count} source samples derived from line crops, found {len(source_sample_ids)}"
        )

    source_names_by_canonical = {
        _canonical_emmo_sample_name(source_name): source_name
        for source_name in image_by_stem
    }
    missing_images = sorted(
        sample_id for sample_id in source_sample_ids if sample_id not in source_names_by_canonical
    )
    if missing_images:
        raise ValueError(
            f"No source image for derived sample(s): {', '.join(missing_images)}"
        )

    source_samples: list[SourceSample] = []
    for sample_id in sorted(source_sample_ids, key=str.casefold):
        source_name = source_names_by_canonical[sample_id]
        ground_truth_path = ground_truth_directory / f"{source_name}_gt.txt"
        if not ground_truth_path.is_file():
            raise ValueError(f"No ground-truth text for source sample: {sample_id}")
        source_samples.append(
            SourceSample(
                sample_id=sample_id,
                image_path=image_by_stem[source_name],
                ground_truth_path=ground_truth_path,
            )
        )
    return source_samples, crop_rows


def _mime_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _upsert_samples(
    repository: BootstrapRepository,
    connection: Connection,
    source_samples: Iterable[SourceSample],
) -> None:
    positions: dict[str, int] = {}
    for source in source_samples:
        document_id = parse_sample_name(source.sample_id).document_id
        document_position = None
        if document_id is not None:
            document_position = positions.get(document_id, 0)
            positions[document_id] = document_position + 1
        payload = {
            "name": source.sample_id,
            "document_id": document_id,
            "document_position": document_position,
            "blob": source.image_path.read_bytes(),
            "mime_type": _mime_type(source.image_path),
            "ground_truth_text": source.ground_truth_path.read_text(encoding="utf-8"),
        }
        repository.upsert_sample(
            source.sample_id, payload, conn=connection
        )


def _upsert_derivative_group(
    repository: BootstrapRepository, connection: Connection
) -> int:
    position_rule = {
        "membership_derivative_field": "name",
        "membership_operator": "contains",
        "membership_pattern": "_line_",
        "membership_case_sensitive": False,
    }
    group_payload = {
        "description": f"{DATASET_NAME} eScriptorium segmentation line crops.",
        "position_rule": position_rule,
        "mapping_type": "one-to-many",
        "status": "active",
    }
    return repository.upsert_derivative_group(
        name=DERIVATIVE_GROUP_NAME,
        values=group_payload,
        mapping_values={
            "derivative_field": "name",
            "operator": "contains",
            "pattern": "_line_",
            "case_sensitive": False,
        },
        conn=connection,
    )


def _upsert_derivatives(
    repository: BootstrapRepository,
    connection: Connection,
    crops: Iterable[LineCrop],
    derivative_group_id: int,
) -> int:
    derivative_count = 0
    for crop in crops:
        payload = {
            "derivative_group_id": derivative_group_id,
            "category": "decomposition",
            "blob": crop.image_path.read_bytes(),
            "mime_type": _mime_type(crop.image_path),
        }
        repository.upsert_derivative(
            sample_id=crop.sample_id,
            name=crop.derivative_name,
            values=payload,
            conn=connection,
        )
        derivative_count += 1
    return derivative_count


def _upsert_demo_sample_set(
    repository: BootstrapRepository,
    connection: Connection,
    sample_ids: list[str],
) -> int:
    return repository.upsert_sample_set(
        name=SAMPLE_SET_NAME,
        values={
            "description": "Economic Upheaval source pages for the transcription demo.",
            "status": "active",
        },
        sample_ids=sample_ids,
        label="demo sample set",
        conn=connection,
    )


def _upsert_transcription_smoke_test(
    repository: BootstrapRepository,
    connection: Connection,
    sample_ids: list[str],
    *,
    executor: str,
    config: dict,
) -> tuple[int, int]:
    """Upsert one provider's finalized image-transcription workflow."""
    from backend.services.executor_validation import validate_config

    definition = repository.fetch_executor(executor, conn=connection)
    config = validate_config(definition, config, "transcribe")
    label = {"gemini": "Gemini", "anthropic": "Anthropic"}[executor]
    template_name = f"{label} transcription payload"
    step_name = f"{label} transcription step"
    workflow_name = f"{label} transcription"
    sample_set_id = repository.upsert_sample_set(
        name=SAMPLE_SET_NAME,
        values={
            "description": "Economic Upheaval source pages for the transcription smoke test.",
            "status": "active",
        },
        sample_ids=sample_ids,
        label="smoke-test sample set",
        conn=connection,
    )

    prompt = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": """You are transcribing an early modern English manuscript image.

Return a literal diplomatic transcription of visible handwriting only.

Accuracy is more important than completeness. A short transcription is better than a speculative transcription.

Line rule:

- Output one line only when there is a visible handwritten line on the page.
- Do not create placeholder lines for blank space.
- Do not write [unclear line] unless there is clearly a handwritten line present but unreadable.
- Stop transcribing when the visible handwriting stops.

Do not include catalog labels, shelfmarks, page numbers, filenames, metadata, modern notes, timestamps, explanations, or commentary.

Preserve original spelling, capitalization, punctuation, abbreviations, and line breaks.

Do not modernize words.
Do not expand abbreviations.
Do not correct grammar.
Do not infer missing words.
Do not substitute a likely word for a visually uncertain word.

For uncertain visible handwriting:

- uncertain word: [word?]
- partly visible word: wor[?]
- illegible visible word: [illegible]
- illegible visible line: [unclear line]

If no visible handwritten manuscript text is present, return an empty response.

Output only the transcription."""
                    },
                    {
                        "inline_data": {
                            "mime_type": "{{sample.mime_type}}",
                            "data": "{{sample.blob}}",
                        }
                    },
                ],
            }
        ]
    }
    if executor == "anthropic":
        prompt = {"messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64",
                "media_type": "{{sample.mime_type}}",
                "data": "{{sample.blob}}"}},
            {"type": "text", "text": prompt["contents"][0]["parts"][0]["text"]},
        ]}]}
    template_values = {
        "model_family": executor,
        "payload": prompt,
        "status": "active",
    }
    template_id = repository.upsert_payload_template(
        template_name, template_values, conn=connection
    )

    output_values = {
        "item_schema": {"type": "string"},
        "instructions": "Literal diplomatic transcription only; no commentary or metadata.",
        "status": "active",
    }
    output_spec_id = repository.upsert_output_spec(
        SMOKE_OUTPUT_SPEC_NAME, output_values, conn=connection
    )

    step_values = {
        "step_executor_id": executor,
        "method": "transcribe",
        "executor_config": config,
        "execution_scope": "samples",
        "output_scope": "samples",
        "payload_template_id": template_id,
        "output_spec_id": output_spec_id,
        "status": "active",
    }
    step_id = repository.upsert_workflow_step(
        step_name, step_values, conn=connection
    )

    workflow_values = {
        "description": f"{label} literal diplomatic transcription of the Economic Upheaval sample set.",
        "sample_set_id": sample_set_id,
        "status": "finalized",
    }
    workflow_id = repository.upsert_workflow(
        workflow_name, workflow_values, conn=connection
    )
    repository.replace_workflow_graph(workflow_id, step_id, conn=connection)
    return sample_set_id, workflow_id


def seed_dataset(
    engine: Engine,
    emmo_root: Path,
    *,
    expected_sample_count: int = EXPECTED_SAMPLE_COUNT,
) -> SeedResult:
    source_samples, crops = discover_dataset(
        emmo_root, expected_sample_count=expected_sample_count
    )
    repository = BootstrapRepository(engine)
    with repository.transaction() as connection:
        _upsert_samples(repository, connection, source_samples)
        derivative_group_id = _upsert_derivative_group(repository, connection)
        derivative_count = _upsert_derivatives(
            repository, connection, crops, derivative_group_id
        )
        sample_ids = [sample.sample_id for sample in source_samples]
        sample_set_id = _upsert_demo_sample_set(
            repository, connection, sample_ids
        )
    return SeedResult(
        sample_count=len(source_samples),
        derivative_count=derivative_count,
        sample_set_id=sample_set_id,
        derivative_group_id=derivative_group_id,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap EMMO manuscript samples, line crops, and mappings."
    )
    parser.add_argument(
        "--emmo-root",
        type=Path,
        default=os.getenv("EMMO_ROOT"),
        help="EMMO directory containing images, ground_truth_txt, and segementation_line_crops.",
    )
    parser.add_argument(
        "--expected-sample-count", type=int, default=EXPECTED_SAMPLE_COUNT
    )
    args = parser.parse_args()
    if args.emmo_root is None:
        parser.error("--emmo-root or EMMO_ROOT is required")
    if args.expected_sample_count < 1:
        parser.error("--expected-sample-count must be at least 1")

    result = seed_dataset(
        get_engine(),
        args.emmo_root.expanduser().resolve(),
        expected_sample_count=args.expected_sample_count,
    )
    print(
        "Seeded "
        f"{result.sample_count} samples and {result.derivative_count} line-crop derivatives "
        f"(sample_set_id={result.sample_set_id}, derivative_group_id={result.derivative_group_id})."
    )


if __name__ == "__main__":
    main()
