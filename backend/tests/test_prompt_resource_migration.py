from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from alembic import command
from alembic.config import Config
from sqlalchemy import Column, Integer, JSON, MetaData, String, Table, create_engine, insert, select


class PromptResourceMigrationTests(unittest.TestCase):
    def test_legacy_selections_and_referenced_fields_are_backfilled(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database_path = Path(directory) / "legacy-prompts.db"
            database_url = f"sqlite:///{database_path}"
            engine = create_engine(database_url)
            self.addCleanup(engine.dispose)
            legacy = MetaData()
            templates = Table(
                "payload_templates",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("payload", JSON, nullable=False),
            )
            resources = Table(
                "prompt_resources",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("payload_template_id", Integer, nullable=False),
                Column("name", String(128), nullable=False),
                Column("source_table", String(64), nullable=False),
                Column("batch_limit", Integer, nullable=False),
            )
            conditions = Table(
                "prompt_resource_conditions",
                legacy,
                Column("id", Integer, primary_key=True),
                Column("prompt_resource_id", Integer, nullable=False),
                Column("field_name", String(128), nullable=False),
                Column("operator", String(32), nullable=False),
                Column("value_type", String(32), nullable=False),
                Column("value", String(1024), nullable=False),
                Column("position", Integer, nullable=False),
            )
            legacy.create_all(engine)
            with engine.begin() as connection:
                connection.execute(
                    insert(templates).values(
                        id=1,
                        payload={
                            "instruction": "{{guide.text}}",
                            "page": "{{pages.blob}}",
                        },
                    )
                )
                connection.execute(insert(resources), [
                    {"id": 1, "payload_template_id": 1, "name": "guide", "source_table": "assets", "batch_limit": 1},
                    {"id": 2, "payload_template_id": 1, "name": "pages", "source_table": "samples", "batch_limit": 10},
                ])
                connection.execute(insert(conditions), [
                    {"id": 1, "prompt_resource_id": 1, "field_name": "id", "operator": "equals", "value_type": "manual", "value": "42", "position": 0},
                    {"id": 2, "prompt_resource_id": 2, "field_name": "id", "operator": "equals", "value_type": "sample-field", "value": "id", "position": 0},
                ])

            config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
            config.set_main_option("sqlalchemy.url", database_url)
            with mock.patch.dict(os.environ, {"DATABASE_URL": database_url}):
                command.stamp(config, "20260921_04")
                command.upgrade(config, "head")

            migrated = MetaData()
            migrated.reflect(bind=engine)
            with engine.connect() as connection:
                rows = connection.execute(
                    select(migrated.tables["prompt_resources"]).order_by(
                        migrated.tables["prompt_resources"].c.id
                    )
                ).mappings().all()
                preserved_conditions = connection.execute(
                    select(migrated.tables["prompt_resource_conditions"])
                ).all()
            self.assertEqual("content", rows[0]["type"])
            self.assertEqual("42", rows[0]["row_key"])
            self.assertEqual("binding", rows[1]["type"])
            self.assertIsNone(rows[1]["row_key"])
            self.assertNotIn("fields", rows[1])
            self.assertEqual(2, len(preserved_conditions))


if __name__ == "__main__":
    unittest.main()
