from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import backend.api.dependencies  # noqa: F401 - registers table metadata
from sqlalchemy import create_engine, select

from backend.database.schema import metadata
from backend.database.tables.derivative_groups_table import derivative_groups
from backend.database.tables.derivatives_table import derivatives
from backend.database.tables.sample_set_samples_table import sample_set_samples
from backend.database.tables.sample_sets_table import sample_sets
from backend.database.tables.samples_table import samples
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows
from backend.scripts.bootstrapping.manuscripts import seed_dataset


class ManuscriptBootstrapTests(unittest.TestCase):
    def test_bootstraps_emmo_records_idempotently(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            emmo_root = Path(temporary_directory) / "EMMO"
            images = emmo_root / "images"
            ground_truth = emmo_root / "ground_truth_txt"
            crops = emmo_root / "segementation_line_crops"
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
            first = seed_dataset(engine, emmo_root, expected_sample_count=1)
            second = seed_dataset(engine, emmo_root, expected_sample_count=1)

            self.assertEqual(first, second)
            self.assertEqual(1, first.sample_count)
            self.assertEqual(2, first.derivative_count)
            with engine.connect() as connection:
                self.assertEqual(1, len(connection.execute(select(samples)).all()))
                self.assertEqual(2, len(connection.execute(select(derivatives)).all()))
                self.assertEqual(1, len(connection.execute(select(sample_sets)).all()))
                self.assertEqual(
                    [("folio_001", 0)],
                    connection.execute(
                        select(
                            sample_set_samples.c.sample_id,
                            sample_set_samples.c.position,
                        )
                    ).all(),
                )
                self.assertEqual(
                    "Line Crops",
                    connection.execute(select(derivative_groups.c.name)).scalar_one(),
                )
                self.assertEqual([], connection.execute(select(workflows)).all())
                self.assertEqual([], connection.execute(select(workflow_steps)).all())
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
