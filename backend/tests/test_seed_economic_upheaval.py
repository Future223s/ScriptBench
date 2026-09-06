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
from backend.database.tables.sample_sets_table import sample_sets
from backend.database.tables.samples_table import samples
from backend.scripts.seed_economic_upheaval import seed_dataset


class EconomicUpheavalSeedTests(unittest.TestCase):
    def test_seeds_dataset_and_can_be_run_again(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_root = Path(temporary_directory)
            images = source_root / "01_source_material" / "EMMO" / "images"
            ground_truth = (
                source_root / "01_source_material" / "EMMO" / "ground_truth_txt"
            )
            crops = (
                source_root
                / "02_model_outputs"
                / "escriptorium"
                / "segmentation_line_crops"
            )
            images.mkdir(parents=True)
            ground_truth.mkdir(parents=True)
            crops.mkdir(parents=True)
            (images / "folio_001.png").write_bytes(b"source image")
            (ground_truth / "folio_001_gt.txt").write_text(
                "transcribed text", encoding="utf-8"
            )
            (crops / "folio_001_line_001.png").write_bytes(b"first line")
            (crops / "folio_001_line_002.png").write_bytes(b"second line")

            engine = create_engine("sqlite:///:memory:", future=True)
            metadata.create_all(engine)
            first = seed_dataset(engine, source_root, expected_sample_count=1)
            second = seed_dataset(engine, source_root, expected_sample_count=1)

            self.assertEqual(1, first.sample_count)
            self.assertEqual(2, first.artifact_count)
            self.assertEqual(first, second)
            with engine.connect() as connection:
                self.assertEqual(
                    1, len(connection.execute(select(samples.c.sample_id)).all())
                )
                self.assertEqual(
                    2, len(connection.execute(select(artifacts.c.artifact_id)).all())
                )
                sample_set_row = (
                    connection.execute(select(sample_sets)).mappings().one()
                )
                self.assertEqual("Test", sample_set_row["sample_set_name"])
                self.assertEqual("active", sample_set_row["status"])
                self.assertEqual(
                    [("folio_001", 0)],
                    connection.execute(
                        select(
                            sample_set_samples.c.sample_id,
                            sample_set_samples.c.position,
                        )
                    ).all(),
                )
                group_row = connection.execute(select(artifact_groups)).mappings().one()
                self.assertEqual("Line Crops", group_row["artifact_group_name"])
                self.assertEqual("one-to-many", group_row["mapping_type"])
                seeded_artifacts = connection.execute(
                    select(
                        artifacts.c.originating_sample_id,
                        artifacts.c.artifact_group_name,
                    ).order_by(artifacts.c.artifact_name)
                ).all()
                self.assertEqual(
                    [("folio_001", "Line Crops"), ("folio_001", "Line Crops")],
                    seeded_artifacts,
                )
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
