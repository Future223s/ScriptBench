from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from alembic import command
from alembic.config import Config
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    Integer,
    JSON,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    insert,
    inspect,
    select,
)


class StepOutputMigrationTests(unittest.TestCase):
    def test_legacy_attempts_are_preserved_and_successes_are_published(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "legacy.db"
            database_url = f"sqlite:///{database_path}"
            engine = create_engine(database_url)
            self.addCleanup(engine.dispose)
            legacy = MetaData()
            workflows = Table("workflows", legacy, Column("id", Integer, primary_key=True))
            samples = Table("samples", legacy, Column("id", String(255), primary_key=True))
            workflow_steps = Table(
                "workflow_steps", legacy, Column("id", Integer, primary_key=True)
            )
            workflow_dag_nodes = Table(
                "workflow_dag_nodes",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("workflow_step_id", Integer, nullable=False),
                Column("execution_scope", String(32), nullable=False),
            )
            execution_jobs = Table(
                "execution_jobs",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("workflow_id", Integer, nullable=False),
                Column("workflow_step_id", Integer, nullable=True),
                Column("sample_id", String(255), nullable=True),
                Column("execution_scope", String(32), nullable=False),
                Column("input_refs", JSON, nullable=False),
            )
            step_outputs = Table(
                "step_outputs",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("execution_job_id", Integer, nullable=False),
                Column("workflow_id", Integer, nullable=False),
                Column("workflow_step_id", Integer, nullable=False),
                Column("sample_id", String(255), nullable=True),
                Column("attempt_no", Integer, nullable=False),
                Column("assembled_model_payload", JSON, nullable=False),
                Column("raw_model_response", Text, nullable=False),
                Column("parsed_output", JSON, nullable=True),
                Column("raw_individual_outputs", JSON, nullable=True),
                Column("complete_output", JSON, nullable=True),
                Column("parse_status", String(32), nullable=True, index=True),
                Column("parse_error", Text, nullable=True),
                Column("cer", Float, nullable=True),
                Column("wer", Float, nullable=True),
                Column("hallucination_count", Integer, nullable=True),
                Column("time_elapsed", Float, nullable=False),
                Column("started_at", DateTime(timezone=True), nullable=False),
                Column("completed_at", DateTime(timezone=True), nullable=False),
                Column("created_at", DateTime(timezone=True), nullable=False),
                UniqueConstraint(
                    "execution_job_id",
                    "workflow_step_id",
                    name="uq_step_outputs_job_step",
                ),
                CheckConstraint(
                    "(parse_status IS NULL) OR (parse_status IN ('success', 'failed'))",
                    name="ck_step_outputs_parse_status",
                ),
            )
            legacy.create_all(engine)

            now = datetime.now(timezone.utc)
            batch_outputs = [
                {"entity_id": "s1", "output": "first"},
                {"entity_id": "s2", "output": "second"},
            ]
            with engine.begin() as connection:
                connection.execute(insert(workflows).values(id=1))
                connection.execute(insert(samples), [{"id": "s1"}, {"id": "s2"}])
                connection.execute(insert(workflow_steps), [{"id": 10}, {"id": 11}])
                connection.execute(insert(workflow_dag_nodes), [
                    {"id": 100, "workflow_step_id": 10, "execution_scope": "samples_batch"},
                    {"id": 101, "workflow_step_id": 11, "execution_scope": "samples"},
                ])
                connection.execute(insert(execution_jobs), [
                    {
                        "id": 1000,
                        "workflow_id": 1,
                        "workflow_step_id": 10,
                        "sample_id": None,
                        "execution_scope": "samples_batch",
                        "input_refs": [
                            {"entity_type": "sample", "entity_id": "s1"},
                            {"entity_type": "sample", "entity_id": "s2"},
                        ],
                    },
                    {
                        "id": 1001,
                        "workflow_id": 1,
                        "workflow_step_id": 11,
                        "sample_id": "s1",
                        "execution_scope": "samples",
                        "input_refs": [
                            {"entity_type": "sample", "entity_id": "s1"}
                        ],
                    },
                ])
                connection.execute(insert(step_outputs), [
                    {
                        "id": 1,
                        "execution_job_id": 1000,
                        "workflow_id": 1,
                        "workflow_step_id": 10,
                        "sample_id": None,
                        "attempt_no": 1,
                        "assembled_model_payload": {"prompt": "batch"},
                        "raw_model_response": "batch response",
                        "parsed_output": {"outputs": batch_outputs},
                        "raw_individual_outputs": batch_outputs,
                        "complete_output": {"outputs": batch_outputs},
                        "parse_status": "success",
                        "parse_error": None,
                        "cer": None,
                        "wer": None,
                        "hallucination_count": None,
                        "time_elapsed": 1.0,
                        "started_at": now,
                        "completed_at": now,
                        "created_at": now,
                    },
                    {
                        "id": 2,
                        "execution_job_id": 1001,
                        "workflow_id": 1,
                        "workflow_step_id": 11,
                        "sample_id": "s1",
                        "attempt_no": 1,
                        "assembled_model_payload": {"prompt": "single"},
                        "raw_model_response": "invalid",
                        "parsed_output": None,
                        "raw_individual_outputs": None,
                        "complete_output": None,
                        "parse_status": "failed",
                        "parse_error": "invalid JSON",
                        "cer": None,
                        "wer": None,
                        "hallucination_count": None,
                        "time_elapsed": 2.0,
                        "started_at": now,
                        "completed_at": now,
                        "created_at": now,
                    },
                ])

            config = Config(
                str(Path(__file__).resolve().parents[1] / "alembic.ini")
            )
            config.set_main_option("sqlalchemy.url", database_url)
            with mock.patch.dict(os.environ, {"DATABASE_URL": database_url}):
                command.stamp(config, "20260921_03")
                command.upgrade(config, "head")

            migrated = MetaData()
            migrated.reflect(bind=engine)
            with engine.connect() as connection:
                attempts = connection.execute(
                    select(migrated.tables["raw_outputs"]).order_by(
                        migrated.tables["raw_outputs"].c.id
                    )
                ).mappings().all()
                published = connection.execute(
                    select(migrated.tables["step_outputs"]).order_by(
                        migrated.tables["step_outputs"].c.entity_key
                    )
                ).mappings().all()
                steps = connection.execute(
                    select(migrated.tables["workflow_steps"]).order_by(
                        migrated.tables["workflow_steps"].c.id
                    )
                ).mappings().all()

            self.assertEqual(["success", "failed"], [row["parse_status"] for row in attempts])
            self.assertEqual(
                [("s1", "first"), ("s2", "second")],
                [(row["entity_key"], row["output"]) for row in published],
            )
            self.assertEqual(
                ["samples_batch", "samples"],
                [row["execution_scope"] for row in steps],
            )
            self.assertEqual(
                ["samples_batch", "samples"],
                [row["output_scope"] for row in steps],
            )
            self.assertNotIn(
                "raw_model_response",
                {column["name"] for column in inspect(engine).get_columns("step_outputs")},
            )


if __name__ == "__main__":
    unittest.main()
