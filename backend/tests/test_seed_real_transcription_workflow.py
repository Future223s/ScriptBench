from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import backend.api.dependencies  # noqa: F401 - registers database tables
from sqlalchemy import create_engine, select

from backend.database.schema import metadata
from backend.database.tables.artifact_groups_table import artifact_groups
from backend.database.tables.artifacts_table import artifacts
from backend.database.tables.sample_set_samples_table import sample_set_samples
from backend.database.tables.samples_table import samples
from backend.scripts.seed_real_transcription_workflow import seed_dataset


class RealTranscriptionSeedTests(unittest.TestCase):
    def test_seeds_original_samples_and_workflow_artifacts_idempotently(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_root = Path(temporary_directory)
            images = source_root / "images"
            preprocessed = source_root / "preprocessed_llm"
            gemini_inputs = source_root / "gemini_inputs" / "folio_001"
            crops = gemini_inputs / "flagged_crops"
            ground_truth = source_root / "ground_truth_txt"
            for directory in (images, preprocessed, crops, ground_truth):
                directory.mkdir(parents=True)

            (images / "folio_001.png").write_bytes(b"original image")
            (preprocessed / "folio_001_PREP.png").write_bytes(b"preprocessed image")
            (gemini_inputs / "folio_001_qc_overlay.png").write_bytes(b"qc overlay")
            (crops / "flagged_crop_001.png").write_bytes(b"missed crop one")
            (crops / "flagged_crop_002.png").write_bytes(b"missed crop two")
            (ground_truth / "folio_001_gt.txt").write_text(
                "ground truth", encoding="utf-8"
            )

            engine = create_engine("sqlite:///:memory:", future=True)
            metadata.create_all(engine)
            first = seed_dataset(engine, source_root, expected_sample_count=1)
            second = seed_dataset(engine, source_root, expected_sample_count=1)

            self.assertEqual(1, first.sample_count)
            self.assertEqual(1, first.overlay_count)
            self.assertEqual(2, first.missed_crop_count)
            self.assertEqual(first, second)
            with engine.connect() as connection:
                sample = connection.execute(select(samples)).mappings().one()
                self.assertEqual(b"original image", sample["sample_blob"])
                self.assertEqual("ground truth", sample["ground_truth_text"])
                self.assertEqual(
                    1, len(connection.execute(select(sample_set_samples)).all())
                )
                self.assertEqual(
                    2, len(connection.execute(select(artifact_groups)).all())
                )
                seeded_artifacts = connection.execute(
                    select(
                        artifacts.c.originating_sample_id, artifacts.c.artifact_group_id
                    ).order_by(artifacts.c.artifact_name)
                ).all()
                self.assertEqual(
                    [
                        ("folio_001", first.missed_crops_group_id),
                        ("folio_001", first.missed_crops_group_id),
                        ("folio_001", first.qc_overlay_group_id),
                    ],
                    seeded_artifacts,
                )
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
