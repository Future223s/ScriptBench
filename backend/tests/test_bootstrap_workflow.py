from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import backend.api.dependencies  # noqa: F401 - registers table metadata
from sqlalchemy import create_engine, select

from backend.database.schema import metadata
from backend.database.tables.output_specs_table import output_specs
from backend.database.tables.payload_templates_table import payload_templates
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows
from backend.scripts.bootstrapping.manuscripts import seed_dataset
from backend.scripts.bootstrapping.workflow import bootstrap_workflow


class WorkflowBootstrapTests(unittest.TestCase):
    def test_bootstraps_each_supported_executor_idempotently(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            emmo_root = Path(temporary_directory) / "EMMO"
            (emmo_root / "images").mkdir(parents=True)
            (emmo_root / "ground_truth_txt").mkdir()
            (emmo_root / "segementation_line_crops").mkdir()
            (emmo_root / "images" / "folio_001.png").write_bytes(b"source image")
            (emmo_root / "ground_truth_txt" / "folio_001_gt.txt").write_text("text")
            (emmo_root / "segementation_line_crops" / "folio_001_line_001.png").write_bytes(b"line")

            engine = create_engine("sqlite:///:memory:", future=True)
            metadata.create_all(engine)
            seed_dataset(engine, emmo_root, expected_sample_count=1)
            gemini_first = bootstrap_workflow(engine, "gemini")
            gemini_second = bootstrap_workflow(engine, "gemini")
            anthropic_first = bootstrap_workflow(engine, "anthropic")
            anthropic_second = bootstrap_workflow(engine, "anthropic")

            self.assertEqual(gemini_first, gemini_second)
            self.assertEqual(anthropic_first, anthropic_second)
            with engine.connect() as connection:
                self.assertEqual(
                    {"Gemini transcription", "Anthropic transcription"},
                    set(
                        connection.execute(
                            select(workflows.c.name)
                        ).scalars().all()
                    ),
                )
                self.assertEqual(
                    {"Gemini transcription step", "Anthropic transcription step"},
                    set(
                        connection.execute(
                            select(workflow_steps.c.name)
                        ).scalars().all()
                    ),
                )
                self.assertEqual(2, len(connection.execute(select(payload_templates)).all()))
                self.assertEqual(1, len(connection.execute(select(output_specs)).all()))
                self.assertEqual(2, len(connection.execute(select(workflow_dag_nodes)).all()))
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
