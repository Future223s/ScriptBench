from __future__ import annotations

import argparse
import mimetypes
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection, Engine

from backend.api.dependencies import get_engine
from backend.database.tables.derivative_groups_table import derivative_groups
from backend.database.tables.derivatives_table import derivatives
from backend.database.tables.membership_mapping_table import membership_mapping
from backend.database.tables.sample_mapping_table import sample_mapping
from backend.database.tables.sample_set_samples_table import sample_set_samples
from backend.database.tables.sample_sets_table import sample_sets
from backend.database.tables.samples_table import samples
from backend.database.tables.output_specs_table import output_specs
from backend.database.tables.payload_templates_table import payload_templates
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows

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
        sample_id = match.group("name")
        source_sample_ids.add(sample_id)
        crop_rows.append(
            LineCrop(image_path=crop_path, sample_id=sample_id)
        )

    if len(source_sample_ids) != expected_sample_count:
        raise ValueError(
            f"Expected {expected_sample_count} source samples derived from line crops, found {len(source_sample_ids)}"
        )

    missing_images = sorted(
        sample_id for sample_id in source_sample_ids if sample_id not in image_by_stem
    )
    if missing_images:
        raise ValueError(
            f"No source image for derived sample(s): {', '.join(missing_images)}"
        )

    source_samples: list[SourceSample] = []
    for sample_id in sorted(source_sample_ids, key=str.casefold):
        ground_truth_path = ground_truth_directory / f"{sample_id}_gt.txt"
        if not ground_truth_path.is_file():
            raise ValueError(f"No ground-truth text for source sample: {sample_id}")
        source_samples.append(
            SourceSample(
                sample_id=sample_id,
                image_path=image_by_stem[sample_id],
                ground_truth_path=ground_truth_path,
            )
        )
    return source_samples, crop_rows


def _mime_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _single_named_row(
    connection: Connection, table, name_column, name: str, label: str
) -> dict | None:
    rows = connection.execute(select(table).where(name_column == name)).mappings().all()
    if len(rows) > 1:
        raise ValueError(
            f"Multiple {label} rows named '{name}' exist; resolve them before seeding"
        )
    return dict(rows[0]) if rows else None


def _inserted_id(result, label: str) -> int:
    inserted_id = (
        result.inserted_primary_key[0] if result.inserted_primary_key else None
    )
    if inserted_id is None:
        raise RuntimeError(f"Failed to insert {label}")
    return int(inserted_id)


def _upsert_samples(
    connection: Connection, source_samples: Iterable[SourceSample]
) -> None:
    for source in source_samples:
        payload = {
            "name": source.sample_id,
            "blob": source.image_path.read_bytes(),
            "mime_type": _mime_type(source.image_path),
            "ground_truth_text": source.ground_truth_path.read_text(encoding="utf-8"),
        }
        existing = connection.execute(
            select(samples.c.id).where(samples.c.id == source.sample_id)
        ).scalar_one_or_none()
        if existing is not None:
            connection.execute(
                update(samples)
                .where(samples.c.id == source.sample_id)
                .values(**payload)
            )
            continue

        conflicting_sample_id = connection.execute(
            select(samples.c.id).where(samples.c.name == source.sample_id)
        ).scalar_one_or_none()
        if conflicting_sample_id is not None:
            raise ValueError(
                f"Sample name '{source.sample_id}' is already owned by sample ID '{conflicting_sample_id}'"
            )
        connection.execute(
            insert(samples).values(id=source.sample_id, **payload)
        )


def _upsert_mapping(
    connection: Connection, table, derivative_group_id: int, payload: dict, label: str
) -> int:
    existing = (
        connection.execute(
            select(table).where(table.c.derivative_group_id == derivative_group_id)
        )
        .mappings()
        .one_or_none()
    )
    if existing is None:
        return _inserted_id(
            connection.execute(
                insert(table).values(derivative_group_id=derivative_group_id, **payload)
            ),
            label,
        )
    connection.execute(
        update(table)
        .where(table.c.derivative_group_id == derivative_group_id)
        .values(**payload)
    )
    return int(existing["id"])


def _upsert_derivative_group(connection: Connection) -> int:
    position_rule = {
        "membership_derivative_field": "name",
        "membership_operator": "contains",
        "membership_pattern": "_line_",
        "membership_case_sensitive": False,
        "sample_mapping_derivative_field": "name",
        "sample_mapping_sample_field": "name",
        "sample_mapping_operator": "contains",
        "sample_mapping_case_sensitive": False,
    }
    group_payload = {
        "description": f"{DATASET_NAME} eScriptorium segmentation line crops.",
        "position_rule": position_rule,
        "mapping_type": "one-to-many",
        "status": "active",
    }
    existing = _single_named_row(
        connection,
        derivative_groups,
        derivative_groups.c.name,
        DERIVATIVE_GROUP_NAME,
        "derivative group",
    )
    if existing is None:
        derivative_group_id = _inserted_id(
            connection.execute(
                insert(derivative_groups).values(
                    name=DERIVATIVE_GROUP_NAME,
                    **group_payload,
                )
            ),
            "derivative group",
        )
    else:
        derivative_group_id = int(existing["id"])
        connection.execute(
            update(derivative_groups)
            .where(derivative_groups.c.id == derivative_group_id)
            .values(**group_payload)
        )

    _upsert_mapping(
        connection,
        membership_mapping,
        derivative_group_id,
        {
            "derivative_field": "name",
            "operator": "contains",
            "pattern": "_line_",
            "case_sensitive": False,
        },
        "membership_mapping",
    )
    _upsert_mapping(
        connection,
        sample_mapping,
        derivative_group_id,
        {
            "derivative_field": "name",
            "sample_field": "name",
            "operator": "contains",
            "case_sensitive": False,
        },
        "sample_mapping",
    )
    return derivative_group_id


def _upsert_derivatives(
    connection: Connection, crops: Iterable[LineCrop], derivative_group_id: int
) -> int:
    derivative_count = 0
    for crop in crops:
        payload = {
            "derivative_group_id": derivative_group_id,
            "category": "decomposition",
            "blob": crop.image_path.read_bytes(),
            "mime_type": _mime_type(crop.image_path),
        }
        existing = connection.execute(
            select(derivatives.c.id).where(
                derivatives.c.sample_id == crop.sample_id,
                derivatives.c.name == crop.image_path.name,
            )
        ).scalar_one_or_none()
        if existing is None:
            connection.execute(
                insert(derivatives).values(
                    name=crop.image_path.name,
                    sample_id=crop.sample_id,
                    **payload,
                )
            )
        else:
            connection.execute(
                update(derivatives)
                .where(derivatives.c.id == existing)
                .values(**payload)
            )
        derivative_count += 1
    return derivative_count


def _upsert_demo_sample_set(
    connection: Connection, sample_ids: list[str]
) -> int:
    sample_set = _single_named_row(
        connection,
        sample_sets,
        sample_sets.c.name,
        SAMPLE_SET_NAME,
        "demo sample set",
    )
    values = {
        "description": "Economic Upheaval source pages for the transcription demo.",
        "status": "active",
    }
    if sample_set is None:
        sample_set_id = _inserted_id(
            connection.execute(
                insert(sample_sets).values(
                    name=SAMPLE_SET_NAME,
                    **values,
                )
            ),
            "demo sample set",
        )
    else:
        sample_set_id = int(sample_set["id"])
        connection.execute(
            update(sample_sets)
            .where(sample_sets.c.id == sample_set_id)
            .values(**values)
        )
    connection.execute(
        delete(sample_set_samples).where(
            sample_set_samples.c.sample_set_id == sample_set_id
        )
    )
    connection.execute(
        insert(sample_set_samples),
        [
            {
                "sample_set_id": sample_set_id,
                "sample_id": sample_id,
                "position": position,
            }
            for position, sample_id in enumerate(sample_ids)
        ],
    )
    return sample_set_id


def _upsert_transcription_smoke_test(
    connection: Connection, sample_ids: list[str], *, executor: str, config: dict
) -> tuple[int, int]:
    """Upsert one provider's finalized image-transcription workflow."""
    from backend.services.executor_validation import validate_config
    from backend.database.tables.step_executors_table import step_executors

    definition = connection.execute(select(step_executors).where(step_executors.c.id == executor)).mappings().one()
    config = validate_config(definition, config, "transcribe")
    label = {"gemini": "Gemini", "anthropic": "Anthropic"}[executor]
    template_name = f"{label} transcription payload"
    step_name = f"{label} transcription step"
    workflow_name = f"{label} transcription"
    sample_set = _single_named_row(
        connection,
        sample_sets,
        sample_sets.c.name,
        SAMPLE_SET_NAME,
        "smoke-test sample set",
    )
    sample_set_values = {
        "description": "Economic Upheaval source pages for the transcription smoke test.",
        "status": "active",
    }
    if sample_set is None:
        sample_set_id = _inserted_id(
            connection.execute(
                insert(sample_sets).values(
                    name=SAMPLE_SET_NAME,
                    **sample_set_values,
                )
            ),
            "smoke-test sample set",
        )
    else:
        sample_set_id = int(sample_set["id"])
        connection.execute(
            update(sample_sets)
            .where(sample_sets.c.id == sample_set_id)
            .values(**sample_set_values)
        )
    connection.execute(
        delete(sample_set_samples).where(
            sample_set_samples.c.sample_set_id == sample_set_id
        )
    )
    connection.execute(
        insert(sample_set_samples),
        [
            {
                "sample_set_id": sample_set_id,
                "sample_id": sample_id,
                "position": position,
            }
            for position, sample_id in enumerate(sample_ids)
        ],
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
    template = _single_named_row(
        connection,
        payload_templates,
        payload_templates.c.name,
        template_name,
        "smoke-test payload template",
    )
    template_values = {
        "model_family": executor,
        "payload": prompt,
        "status": "active",
    }
    if template is None:
        template_id = _inserted_id(
            connection.execute(
                insert(payload_templates).values(
                    name=template_name,
                    **template_values,
                )
            ),
            "smoke-test payload template",
        )
    else:
        template_id = int(template["id"])
        connection.execute(
            update(payload_templates)
            .where(payload_templates.c.id == template_id)
            .values(**template_values)
        )

    output_spec = _single_named_row(
        connection,
        output_specs,
        output_specs.c.name,
        SMOKE_OUTPUT_SPEC_NAME,
        "smoke-test output specification",
    )
    output_values = {
        "type": "plain-text",
        "item_schema": {"fields": []},
        "instructions": "Literal diplomatic transcription only; no commentary or metadata.",
        "status": "active",
    }
    if output_spec is None:
        output_spec_id = _inserted_id(
            connection.execute(
                insert(output_specs).values(
                    name=SMOKE_OUTPUT_SPEC_NAME,
                    **output_values,
                )
            ),
            "smoke-test output specification",
        )
    else:
        output_spec_id = int(output_spec["id"])
        connection.execute(
            update(output_specs)
            .where(output_specs.c.id == output_spec_id)
            .values(**output_values)
        )

    step = _single_named_row(
        connection,
        workflow_steps,
        workflow_steps.c.name,
        step_name,
        "smoke-test workflow step",
    )
    step_values = {
        "step_executor_id": executor,
        "method": "transcribe",
        "executor_config": config,
        "payload_template_id": template_id,
        "output_spec_id": output_spec_id,
        "status": "active",
    }
    if step is None:
        step_id = _inserted_id(
            connection.execute(
                insert(workflow_steps).values(
                    name=step_name,
                    **step_values,
                )
            ),
            "smoke-test workflow step",
        )
    else:
        step_id = int(step["id"])
        connection.execute(
            update(workflow_steps)
            .where(workflow_steps.c.id == step_id)
            .values(**step_values)
        )

    workflow = _single_named_row(
        connection,
        workflows,
        workflows.c.name,
        workflow_name,
        "smoke-test workflow",
    )
    workflow_values = {
        "description": f"{label} literal diplomatic transcription of the Economic Upheaval sample set.",
        "sample_set_id": sample_set_id,
        "status": "finalized",
    }
    if workflow is None:
        workflow_id = _inserted_id(
            connection.execute(
                insert(workflows).values(
                    name=workflow_name,
                    **workflow_values,
                )
            ),
            "smoke-test workflow",
        )
    else:
        workflow_id = int(workflow["id"])
        connection.execute(
            update(workflows)
            .where(workflows.c.id == workflow_id)
            .values(**workflow_values)
        )

    connection.execute(
        delete(workflow_dag_edges).where(
            workflow_dag_edges.c.workflow_id == workflow_id
        )
    )
    nodes = (
        connection.execute(
            select(workflow_dag_nodes.c.id).where(
                workflow_dag_nodes.c.workflow_id == workflow_id
            )
        )
        .scalars()
        .all()
    )
    if nodes:
        connection.execute(
            update(workflow_dag_nodes)
            .where(workflow_dag_nodes.c.id == nodes[0])
            .values(workflow_step_id=step_id, row=2, col=4)
        )
        if len(nodes) > 1:
            connection.execute(
                delete(workflow_dag_nodes).where(
                    workflow_dag_nodes.c.id.in_(nodes[1:])
                )
            )
    else:
        connection.execute(
            insert(workflow_dag_nodes).values(
                workflow_id=workflow_id,
                workflow_step_id=step_id,
                row=2,
                col=4,
            )
        )
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
    with engine.begin() as connection:
        _upsert_samples(connection, source_samples)
        derivative_group_id = _upsert_derivative_group(connection)
        derivative_count = _upsert_derivatives(connection, crops, derivative_group_id)
        sample_ids = [sample.sample_id for sample in source_samples]
        sample_set_id = _upsert_demo_sample_set(connection, sample_ids)
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
