from __future__ import annotations

import argparse
import mimetypes
import os
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


DATASET_NAME = "Economic Upheaval Real"
SAMPLE_SET_NAME = "Economic Upheaval Real Transcription"
QC_OVERLAY_GROUP_NAME = "Economic Upheaval Real QC Overlays"
MISSED_CROPS_GROUP_NAME = "Economic Upheaval Real Missed Crops"
IMAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"})


@dataclass(frozen=True)
class RealSample:
    sample_id: str
    original_path: Path
    preprocessed_path: Path
    overlay_path: Path
    missed_crop_paths: tuple[Path, ...]
    ground_truth_path: Path | None


@dataclass(frozen=True)
class SeedResult:
    sample_count: int
    overlay_count: int
    missed_crop_count: int
    sample_set_id: int
    qc_overlay_group_id: int
    missed_crops_group_id: int


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


def _require_file(path: Path, description: str) -> Path:
    if not path.is_file():
        raise ValueError(f"Missing {description}: {path}")
    return path


def discover_dataset(
    source_root: Path, *, expected_sample_count: int | None = None
) -> list[RealSample]:
    images_directory = _require_directory(source_root / "images", "original images")
    preprocessed_directory = _require_directory(
        source_root / "preprocessed_llm", "preprocessed images"
    )
    gemini_inputs_directory = _require_directory(
        source_root / "gemini_inputs", "Gemini input"
    )
    ground_truth_directory = source_root / "ground_truth_txt"

    originals = _image_files(images_directory)
    if not originals:
        raise ValueError(f"No original images found in {images_directory}")

    discovered: list[RealSample] = []
    for original_path in originals:
        sample_id = original_path.stem
        preprocessed_path = _require_file(
            preprocessed_directory / f"{sample_id}_PREP{original_path.suffix}",
            f"preprocessed image for sample {sample_id}",
        )
        input_directory = _require_directory(
            gemini_inputs_directory / sample_id,
            f"Gemini input for sample {sample_id}",
        )
        overlay_path = _require_file(
            input_directory / f"{sample_id}_qc_overlay{original_path.suffix}",
            f"QC overlay for sample {sample_id}",
        )
        missed_crops_directory = _require_directory(
            input_directory / "flagged_crops",
            f"missed crops for sample {sample_id}",
        )
        missed_crop_paths = tuple(_image_files(missed_crops_directory))
        if not missed_crop_paths:
            raise ValueError(f"No missed crops found for sample {sample_id}")

        ground_truth_path = ground_truth_directory / f"{sample_id}_gt.txt"
        discovered.append(
            RealSample(
                sample_id=sample_id,
                original_path=original_path,
                preprocessed_path=preprocessed_path,
                overlay_path=overlay_path,
                missed_crop_paths=missed_crop_paths,
                ground_truth_path=(
                    ground_truth_path if ground_truth_path.is_file() else None
                ),
            )
        )

    if expected_sample_count is not None and len(discovered) != expected_sample_count:
        raise ValueError(
            f"Expected {expected_sample_count} samples, found {len(discovered)}"
        )
    return discovered


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


def _upsert_samples(connection: Connection, real_samples: Iterable[RealSample]) -> None:
    for source in real_samples:
        payload = {
            "sample_name": source.sample_id,
            "sample_blob": source.original_path.read_bytes(),
            "sample_mime_type": _mime_type(source.original_path),
            "ground_truth_text": (
                source.ground_truth_path.read_text(encoding="utf-8")
                if source.ground_truth_path is not None
                else None
            ),
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


def _upsert_sample_set(connection: Connection, real_samples: list[RealSample]) -> int:
    existing = _single_named_row(
        connection,
        sample_sets,
        sample_sets.c.sample_set_name,
        SAMPLE_SET_NAME,
        "sample set",
    )
    payload = {
        "sample_set_description": (
            f"{DATASET_NAME}: original page images for the three-pass transcription workflow."
        ),
        "status": "active",
    }
    if existing is None:
        sample_set_id = _inserted_id(
            connection.execute(
                insert(sample_sets).values(sample_set_name=SAMPLE_SET_NAME, **payload)
            ),
            "sample set",
        )
    else:
        sample_set_id = int(existing["sample_set_id"])
        connection.execute(
            update(sample_sets)
            .where(sample_sets.c.sample_set_id == sample_set_id)
            .values(**payload)
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
                "sample_id": sample.sample_id,
                "position": position,
            }
            for position, sample in enumerate(real_samples)
        ],
    )
    return sample_set_id


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


def _upsert_artifact_group(
    connection: Connection, *, name: str, description: str, membership_pattern: str
) -> int:
    group_payload = {
        "artifact_group_description": description,
        "position_rule": {"order_by": "artifact_id", "direction": "asc"},
        "mapping_type": "one-to-many",
        "status": "active",
    }
    existing = _single_named_row(
        connection,
        artifact_groups,
        artifact_groups.c.artifact_group_name,
        name,
        "artifact group",
    )
    if existing is None:
        artifact_group_id = _inserted_id(
            connection.execute(
                insert(artifact_groups).values(
                    artifact_group_name=name,
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
            "pattern": membership_pattern,
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
    connection: Connection,
    real_samples: Iterable[RealSample],
    *,
    artifact_group_id: int,
    artifact_kind: str,
) -> int:
    artifact_count = 0
    for source in real_samples:
        paths = (
            [source.overlay_path]
            if artifact_kind == "overlay"
            else list(source.missed_crop_paths)
        )
        for path in paths:
            artifact_name = f"{source.sample_id}__{path.name}"
            payload = {
                "artifact_group_id": artifact_group_id,
                "artifact_group_name": (
                    QC_OVERLAY_GROUP_NAME
                    if artifact_kind == "overlay"
                    else MISSED_CROPS_GROUP_NAME
                ),
                "artifact_category": "companion",
                "artifact_blob": path.read_bytes(),
                "artifact_mime_type": _mime_type(path),
            }
            existing = connection.execute(
                select(artifacts.c.artifact_id).where(
                    artifacts.c.originating_sample_id == source.sample_id,
                    artifacts.c.artifact_name == artifact_name,
                )
            ).scalar_one_or_none()
            if existing is None:
                connection.execute(
                    insert(artifacts).values(
                        artifact_name=artifact_name,
                        originating_sample_id=source.sample_id,
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


def seed_dataset(
    engine: Engine,
    source_root: Path,
    *,
    expected_sample_count: int | None = None,
) -> SeedResult:
    real_samples = discover_dataset(
        source_root, expected_sample_count=expected_sample_count
    )
    with engine.begin() as connection:
        _upsert_samples(connection, real_samples)
        sample_set_id = _upsert_sample_set(connection, real_samples)
        qc_overlay_group_id = _upsert_artifact_group(
            connection,
            name=QC_OVERLAY_GROUP_NAME,
            description=f"{DATASET_NAME} QC overlay images, one per original sample.",
            membership_pattern="_qc_overlay",
        )
        missed_crops_group_id = _upsert_artifact_group(
            connection,
            name=MISSED_CROPS_GROUP_NAME,
            description=f"{DATASET_NAME} missed-crop images for the crop-aware transcription pass.",
            membership_pattern="_flagged_crop_",
        )
        overlay_count = _upsert_artifacts(
            connection,
            real_samples,
            artifact_group_id=qc_overlay_group_id,
            artifact_kind="overlay",
        )
        missed_crop_count = _upsert_artifacts(
            connection,
            real_samples,
            artifact_group_id=missed_crops_group_id,
            artifact_kind="missed_crop",
        )
    return SeedResult(
        sample_count=len(real_samples),
        overlay_count=overlay_count,
        missed_crop_count=missed_crop_count,
        sample_set_id=sample_set_id,
        qc_overlay_group_id=qc_overlay_group_id,
        missed_crops_group_id=missed_crops_group_id,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed the real Economic Upheaval assets for the three-pass transcription workflow."
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        default=os.getenv("ECONOMIC_REAL_SOURCE_ROOT"),
        help="Directory containing images, preprocessed_llm, and gemini_inputs.",
    )
    parser.add_argument("--expected-sample-count", type=int, default=None)
    args = parser.parse_args()
    if args.source_root is None:
        parser.error("--source-root or ECONOMIC_REAL_SOURCE_ROOT is required")
    if args.expected_sample_count is not None and args.expected_sample_count < 1:
        parser.error("--expected-sample-count must be at least 1")

    result = seed_dataset(
        get_engine(),
        args.source_root.expanduser().resolve(),
        expected_sample_count=args.expected_sample_count,
    )
    print(
        "Seeded "
        f"{result.sample_count} original samples, {result.overlay_count} QC overlays, "
        f"and {result.missed_crop_count} missed crops "
        f"(sample_set_id={result.sample_set_id}, "
        f"qc_overlay_group_id={result.qc_overlay_group_id}, "
        f"missed_crops_group_id={result.missed_crops_group_id})."
    )


if __name__ == "__main__":
    main()
