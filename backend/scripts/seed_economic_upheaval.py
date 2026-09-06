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
from backend.database.tables.artifact_groups_table import artifact_groups
from backend.database.tables.artifacts_table import artifacts
from backend.database.tables.membership_mapping_table import membership_mapping
from backend.database.tables.sample_mapping_table import sample_mapping
from backend.database.tables.sample_set_samples_table import sample_set_samples
from backend.database.tables.sample_sets_table import sample_sets
from backend.database.tables.samples_table import samples
from backend.database.tables.output_specs_table import output_specs
from backend.database.tables.payload_templates_table import payload_template
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows

EXPECTED_SAMPLE_COUNT = 19
DATASET_NAME = "Economic Upheaval"
ARTIFACT_GROUP_NAME = "Line Crops"
SMOKE_SAMPLE_SET_NAME = "test"
SMOKE_PAYLOAD_TEMPLATE_NAME = "test"
SMOKE_OUTPUT_SPEC_NAME = "test"
SMOKE_WORKFLOW_STEP_NAME = "test transcription"
SMOKE_WORKFLOW_NAME = "test"
LINE_CROP_PATTERN = re.compile(r"(?P<sample_name>.+)_line_\d+$", re.IGNORECASE)
IMAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"})


@dataclass(frozen=True)
class SourceSample:
    sample_id: str
    image_path: Path
    ground_truth_path: Path


@dataclass(frozen=True)
class LineCrop:
    image_path: Path
    originating_sample_id: str


@dataclass(frozen=True)
class SeedResult:
    sample_count: int
    artifact_count: int
    sample_set_id: int
    artifact_group_id: int
    smoke_workflow_id: int


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
    source_root: Path, *, expected_sample_count: int
) -> tuple[list[SourceSample], list[LineCrop]]:
    emmo_root = _require_directory(
        source_root / "01_source_material" / "EMMO", "EMMO source"
    )
    images_directory = _require_directory(emmo_root / "images", "source images")
    ground_truth_directory = _require_directory(
        emmo_root / "ground_truth_txt", "ground-truth"
    )
    crops_directory = _require_directory(
        source_root / "02_model_outputs" / "escriptorium" / "segmentation_line_crops",
        "line-crop",
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
        sample_id = match.group("sample_name")
        source_sample_ids.add(sample_id)
        crop_rows.append(
            LineCrop(image_path=crop_path, originating_sample_id=sample_id)
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
            "sample_name": source.sample_id,
            "sample_blob": source.image_path.read_bytes(),
            "sample_mime_type": _mime_type(source.image_path),
            "ground_truth_text": source.ground_truth_path.read_text(encoding="utf-8"),
        }
        existing = connection.execute(
            select(samples.c.sample_id).where(samples.c.sample_id == source.sample_id)
        ).scalar_one_or_none()
        if existing is not None:
            connection.execute(
                update(samples)
                .where(samples.c.sample_id == source.sample_id)
                .values(**payload)
            )
            continue

        conflicting_sample_id = connection.execute(
            select(samples.c.sample_id).where(samples.c.sample_name == source.sample_id)
        ).scalar_one_or_none()
        if conflicting_sample_id is not None:
            raise ValueError(
                f"Sample name '{source.sample_id}' is already owned by sample ID '{conflicting_sample_id}'"
            )
        connection.execute(
            insert(samples).values(sample_id=source.sample_id, **payload)
        )


def _upsert_mapping(
    connection: Connection, table, artifact_group_id: int, payload: dict, label: str
) -> int:
    existing = (
        connection.execute(
            select(table).where(table.c.artifact_group_id == artifact_group_id)
        )
        .mappings()
        .one_or_none()
    )
    if existing is None:
        return _inserted_id(
            connection.execute(
                insert(table).values(artifact_group_id=artifact_group_id, **payload)
            ),
            label,
        )
    connection.execute(
        update(table)
        .where(table.c.artifact_group_id == artifact_group_id)
        .values(**payload)
    )
    return int(existing[f"{label}_id"])


def _upsert_artifact_group(connection: Connection) -> int:
    position_rule = {
        "membership_artifact_field": "artifact_name",
        "membership_operator": "contains",
        "membership_pattern": "_line_",
        "membership_case_sensitive": False,
        "sample_mapping_artifact_field": "artifact_name",
        "sample_mapping_sample_field": "sample_name",
        "sample_mapping_operator": "contains",
        "sample_mapping_case_sensitive": False,
    }
    group_payload = {
        "artifact_group_description": f"{DATASET_NAME} eScriptorium segmentation line crops.",
        "position_rule": position_rule,
        "mapping_type": "one-to-many",
        "status": "active",
    }
    existing = _single_named_row(
        connection,
        artifact_groups,
        artifact_groups.c.artifact_group_name,
        ARTIFACT_GROUP_NAME,
        "artifact group",
    )
    if existing is None:
        artifact_group_id = _inserted_id(
            connection.execute(
                insert(artifact_groups).values(
                    artifact_group_name=ARTIFACT_GROUP_NAME,
                    membership_mapping_id=None,
                    sample_mapping_id=None,
                    **group_payload,
                )
            ),
            "artifact group",
        )
    else:
        artifact_group_id = int(existing["artifact_group_id"])
        connection.execute(
            update(artifact_groups)
            .where(artifact_groups.c.artifact_group_id == artifact_group_id)
            .values(**group_payload)
        )

    membership_mapping_id = _upsert_mapping(
        connection,
        membership_mapping,
        artifact_group_id,
        {
            "artifact_field": "artifact_name",
            "operator": "contains",
            "pattern": "_line_",
            "case_sensitive": False,
        },
        "membership_mapping",
    )
    sample_mapping_id = _upsert_mapping(
        connection,
        sample_mapping,
        artifact_group_id,
        {
            "artifact_field": "artifact_name",
            "sample_field": "sample_name",
            "operator": "contains",
            "case_sensitive": False,
        },
        "sample_mapping",
    )
    connection.execute(
        update(artifact_groups)
        .where(artifact_groups.c.artifact_group_id == artifact_group_id)
        .values(
            membership_mapping_id=membership_mapping_id,
            sample_mapping_id=sample_mapping_id,
        )
    )
    return artifact_group_id


def _upsert_artifacts(
    connection: Connection, crops: Iterable[LineCrop], artifact_group_id: int
) -> int:
    artifact_count = 0
    for crop in crops:
        payload = {
            "artifact_group_id": artifact_group_id,
            "artifact_group_name": ARTIFACT_GROUP_NAME,
            "artifact_category": "decomposition",
            "artifact_blob": crop.image_path.read_bytes(),
            "artifact_mime_type": _mime_type(crop.image_path),
        }
        existing = connection.execute(
            select(artifacts.c.artifact_id).where(
                artifacts.c.originating_sample_id == crop.originating_sample_id,
                artifacts.c.artifact_name == crop.image_path.name,
            )
        ).scalar_one_or_none()
        if existing is None:
            connection.execute(
                insert(artifacts).values(
                    artifact_name=crop.image_path.name,
                    originating_sample_id=crop.originating_sample_id,
                    **payload,
                )
            )
        else:
            connection.execute(
                update(artifacts)
                .where(artifacts.c.artifact_id == existing)
                .values(**payload)
            )
        artifact_count += 1
    return artifact_count


def _upsert_transcription_smoke_test(
    connection: Connection, sample_ids: list[str]
) -> tuple[int, int]:
    """Create one finalized, runnable image-transcription workflow."""
    sample_set = _single_named_row(
        connection,
        sample_sets,
        sample_sets.c.sample_set_name,
        SMOKE_SAMPLE_SET_NAME,
        "smoke-test sample set",
    )
    sample_set_values = {
        "sample_set_description": "Economic Upheaval source pages for the transcription smoke test.",
        "status": "active",
    }
    if sample_set is None:
        sample_set_id = _inserted_id(
            connection.execute(
                insert(sample_sets).values(
                    sample_set_name=SMOKE_SAMPLE_SET_NAME,
                    **sample_set_values,
                )
            ),
            "smoke-test sample set",
        )
    else:
        sample_set_id = int(sample_set["sample_set_id"])
        connection.execute(
            update(sample_sets)
            .where(sample_sets.c.sample_set_id == sample_set_id)
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
                            "mime_type": "{{sample.sample_mime_type}}",
                            "data": "{{sample.sample_blob}}",
                        }
                    },
                ],
            }
        ]
    }
    template = _single_named_row(
        connection,
        payload_template,
        payload_template.c.payload_template_name,
        SMOKE_PAYLOAD_TEMPLATE_NAME,
        "smoke-test payload template",
    )
    template_values = {
        "model_family": "gemini",
        "payload_template": prompt,
        "status": "active",
    }
    if template is None:
        template_id = _inserted_id(
            connection.execute(
                insert(payload_template).values(
                    payload_template_name=SMOKE_PAYLOAD_TEMPLATE_NAME,
                    **template_values,
                )
            ),
            "smoke-test payload template",
        )
    else:
        template_id = int(template["payload_template_id"])
        connection.execute(
            update(payload_template)
            .where(payload_template.c.payload_template_id == template_id)
            .values(**template_values)
        )

    output_spec = _single_named_row(
        connection,
        output_specs,
        output_specs.c.output_spec_name,
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
                    output_spec_name=SMOKE_OUTPUT_SPEC_NAME,
                    **output_values,
                )
            ),
            "smoke-test output specification",
        )
    else:
        output_spec_id = int(output_spec["output_spec_id"])
        connection.execute(
            update(output_specs)
            .where(output_specs.c.output_spec_id == output_spec_id)
            .values(**output_values)
        )

    step = _single_named_row(
        connection,
        workflow_steps,
        workflow_steps.c.step_name,
        SMOKE_WORKFLOW_STEP_NAME,
        "smoke-test workflow step",
    )
    step_values = {
        "model_family": "gemini",
        "model": "gemini-3.1-flash-lite",
        "payload_template_id": template_id,
        "output_spec_id": output_spec_id,
        "status": "active",
    }
    if step is None:
        step_id = _inserted_id(
            connection.execute(
                insert(workflow_steps).values(
                    step_name=SMOKE_WORKFLOW_STEP_NAME,
                    **step_values,
                )
            ),
            "smoke-test workflow step",
        )
    else:
        step_id = int(step["workflow_step_id"])
        connection.execute(
            update(workflow_steps)
            .where(workflow_steps.c.workflow_step_id == step_id)
            .values(**step_values)
        )

    workflow = _single_named_row(
        connection,
        workflows,
        workflows.c.workflow_name,
        SMOKE_WORKFLOW_NAME,
        "smoke-test workflow",
    )
    workflow_values = {
        "workflow_description": "Gemini literal diplomatic transcription of the Economic Upheaval sample set.",
        "sample_set_id": sample_set_id,
        "status": "finalized",
    }
    if workflow is None:
        workflow_id = _inserted_id(
            connection.execute(
                insert(workflows).values(
                    workflow_name=SMOKE_WORKFLOW_NAME,
                    **workflow_values,
                )
            ),
            "smoke-test workflow",
        )
    else:
        workflow_id = int(workflow["workflow_id"])
        connection.execute(
            update(workflows)
            .where(workflows.c.workflow_id == workflow_id)
            .values(**workflow_values)
        )

    connection.execute(
        delete(workflow_dag_edges).where(
            workflow_dag_edges.c.workflow_id == workflow_id
        )
    )
    nodes = (
        connection.execute(
            select(workflow_dag_nodes.c.workflow_dag_node_id).where(
                workflow_dag_nodes.c.workflow_id == workflow_id
            )
        )
        .scalars()
        .all()
    )
    if nodes:
        connection.execute(
            update(workflow_dag_nodes)
            .where(workflow_dag_nodes.c.workflow_dag_node_id == nodes[0])
            .values(workflow_step_id=step_id, row=2, col=4)
        )
        if len(nodes) > 1:
            connection.execute(
                delete(workflow_dag_nodes).where(
                    workflow_dag_nodes.c.workflow_dag_node_id.in_(nodes[1:])
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
    source_root: Path,
    *,
    expected_sample_count: int = EXPECTED_SAMPLE_COUNT,
) -> SeedResult:
    source_samples, crops = discover_dataset(
        source_root, expected_sample_count=expected_sample_count
    )
    with engine.begin() as connection:
        _upsert_samples(connection, source_samples)
        artifact_group_id = _upsert_artifact_group(connection)
        artifact_count = _upsert_artifacts(connection, crops, artifact_group_id)
        sample_set_id, smoke_workflow_id = _upsert_transcription_smoke_test(
            connection, [sample.sample_id for sample in source_samples]
        )
    return SeedResult(
        sample_count=len(source_samples),
        artifact_count=artifact_count,
        sample_set_id=sample_set_id,
        artifact_group_id=artifact_group_id,
        smoke_workflow_id=smoke_workflow_id,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed the Economic Upheaval source pages and line crops."
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        default=os.getenv("ECONOMIC_SOURCE_ROOT"),
        help="Dataset root containing 01_source_material and 02_model_outputs.",
    )
    parser.add_argument(
        "--expected-sample-count", type=int, default=EXPECTED_SAMPLE_COUNT
    )
    args = parser.parse_args()
    if args.source_root is None:
        parser.error("--source-root or ECONOMIC_SOURCE_ROOT is required")
    if args.expected_sample_count < 1:
        parser.error("--expected-sample-count must be at least 1")

    result = seed_dataset(
        get_engine(),
        args.source_root.expanduser().resolve(),
        expected_sample_count=args.expected_sample_count,
    )
    print(
        "Seeded "
        f"{result.sample_count} samples and {result.artifact_count} line-crop artifacts "
        f"(sample_set_id={result.sample_set_id}, artifact_group_id={result.artifact_group_id}, "
        f"smoke_workflow_id={result.smoke_workflow_id})."
    )


if __name__ == "__main__":
    main()
