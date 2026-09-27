"""Create a small, upload-ready Malvern Hills benchmark dataset.

The source pickle is trusted local research data, not accepted from an upload.
The generated JSON/JSONL files contain no pickle objects or machine-specific paths.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_VOLUMES = (
    "1889-05--1909-10",
    "1910-01--1919-11",
    "1923-10--1928-02",
    "1931-11--1935-11",
    "1936-01--1938-03",
)
MODEL_OUTPUT_FIELDS = (
    "azure_ocr",
    "trocr_ocr",
    "docowl2_ocr",
    "docowl2_lines_ocr",
)


def parse_args() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path.home() / "Downloads" / "malvern_hills_trust",
        help="Folder containing the Malvern images and multipage pickle.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository_root / "datasets" / "malvern-hills",
        help="New dataset folder to create.",
    )
    parser.add_argument(
        "--pickle-name",
        default="malvern_hills_multipage_min_5p.pkl",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing generated dataset folder.",
    )
    return parser.parse_args()


def canonical_document_id(document_id: str) -> str:
    return str(document_id).replace("_", "-")


def sample_id(document_id: str, image_path: Path) -> str:
    return f"{canonical_document_id(document_id)}_{image_path.stem}"


def json_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, Path):
        return value.name
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [json_value(item) for item in value]
    return str(value)


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def prepare(source: Path, output: Path, pickle_name: str, force: bool) -> dict[str, Any]:
    pickle_path = source / pickle_name
    if not pickle_path.is_file():
        raise FileNotFoundError(f"Multipage pickle not found: {pickle_path}")
    if output.exists():
        if not force:
            raise FileExistsError(f"Output already exists: {output}; pass --force to replace it")
        shutil.rmtree(output)
    images_root = output / "images"
    ground_truth_root = output / "ground_truth"
    images_root.mkdir(parents=True)
    ground_truth_root.mkdir(parents=True)

    frame = pd.read_pickle(pickle_path)
    selected = frame[frame["doc_id"].isin(DEFAULT_VOLUMES)]
    if selected.empty:
        raise ValueError("The expected historical minute volumes were not found")

    documents: list[dict[str, Any]] = []
    samples: list[dict[str, Any]] = []
    multipage_outputs: list[dict[str, Any]] = []
    checksums: dict[str, str] = {}

    for document_id, row in selected.iterrows():
        source_volume = str(row["doc_id"])
        image_paths = [Path(value) for value in row["img_path"]]
        target_document_id = canonical_document_id(str(document_id))
        page_ids = [sample_id(str(document_id), path) for path in image_paths]
        if len(page_ids) != len(set(page_ids)):
            raise ValueError(f"Duplicate page IDs in document {document_id}")
        if len(row["gt"]) != len(image_paths):
            raise ValueError(f"Ground truth cardinality mismatch in {document_id}")

        metadata = {
            key: json_value(row[key])
            for key in (
                "written_year",
                "original_year",
                "tabular",
                "margin_notes",
                "distractors",
                "non_standard_structure",
                "archaic",
                "poor_quality",
                "multiple_hands",
                "crossings_out",
            )
            if key in selected.columns
        }
        documents.append(
            {
                "id": target_document_id,
                "name": target_document_id,
                "sample_ids": page_ids,
                "metadata": {"source_volume": source_volume, **metadata},
            }
        )

        raw_outputs = {field: [] for field in MODEL_OUTPUT_FIELDS}
        complete_outputs: dict[str, str] = {}
        raw_ground_truth: list[dict[str, str]] = []
        for position, (old_path, entity_id, ground_truth) in enumerate(
            zip(image_paths, page_ids, row["gt"], strict=True)
        ):
            source_image = source / source_volume / old_path.name
            if not source_image.is_file():
                raise FileNotFoundError(f"Source image not found: {source_image}")
            image_relative = Path("images") / f"{entity_id}{old_path.suffix.lower()}"
            gt_relative = Path("ground_truth") / f"{entity_id}_gt.txt"
            image_target = output / image_relative
            gt_target = output / gt_relative
            image_target.parent.mkdir(parents=True, exist_ok=True)
            gt_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_image, image_target)
            gt_target.write_text(str(ground_truth), encoding="utf-8")
            checksums[image_relative.as_posix()] = hashlib.sha256(image_target.read_bytes()).hexdigest()
            samples.append(
                {
                    "id": entity_id,
                    "name": entity_id,
                    "document_id": target_document_id,
                    "document_position": position,
                    "image": image_relative.as_posix(),
                    "ground_truth": gt_relative.as_posix(),
                }
            )
            raw_ground_truth.append(
                {"entity_id": entity_id, "output": str(ground_truth)}
            )
            for field in MODEL_OUTPUT_FIELDS:
                values = list(row[field])
                if len(values) != len(image_paths):
                    raise ValueError(f"{field} cardinality mismatch in {document_id}")
                raw_outputs[field].append(
                    {"entity_id": entity_id, "output": json_value(values[position])}
                )
        for field, values in raw_outputs.items():
            complete_outputs[field] = "\n\n".join(str(item["output"]) for item in values)
        multipage_outputs.append(
            {
                "document_id": target_document_id,
                "sample_ids": page_ids,
                "raw_individual_ground_truth": raw_ground_truth,
                "complete_ground_truth": "\n\n".join(
                    item["output"] for item in raw_ground_truth
                ),
                "raw_individual_outputs": raw_outputs,
                "complete_outputs": complete_outputs,
                "timings": {
                    field: json_value(row[field])
                    for field in (
                        "trocr_ocr_time",
                        "docowl2_ocr_time",
                        "docowl2_lines_ocr_time",
                    )
                    if field in selected.columns
                },
            }
        )

    write_jsonl(output / "samples.jsonl", samples)
    write_jsonl(output / "multipage_outputs.jsonl", multipage_outputs)
    manifest = {
        "dataset": "malvern-hills",
        "source_pickle": pickle_name,
        "document_count": len(documents),
        "sample_count": len(samples),
        "source_volumes": list(DEFAULT_VOLUMES),
        "files": checksums,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (output / "README.md").write_text(
        """# Malvern Hills ScriptBench subset

This generated subset contains 98 pages grouped into 17 complete documents.

1. In File Management, bulk-upload `images/` as the sample folder.
2. Select `ground_truth/` as the matching ground-truth folder.
3. Document records and ordered page membership are created automatically from names.
4. In the Documents tab, optionally assemble PDFs from the uploaded sample images.
5. `multipage_outputs.jsonl` preserves both per-page raw outputs and assembled document outputs.

Sample IDs follow the canonical `<document>_<page>` convention. Document IDs use
hyphens rather than underscores so the page boundary is unambiguous.
Regenerate with `python -m backend.scripts.prepare_malvern_hills`; do not edit generated files manually.
""",
        encoding="utf-8",
    )
    return manifest


def main() -> None:
    args = parse_args()
    manifest = prepare(args.source.expanduser(), args.output, args.pickle_name, args.force)
    print(json.dumps({key: value for key, value in manifest.items() if key != "files"}, indent=2))


if __name__ == "__main__":
    main()
