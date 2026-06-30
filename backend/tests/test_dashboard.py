from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.dependencies import get_engine
from backend.api.main import app


class DashboardLegacySchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self._previous_database_url = os.environ.get("DATABASE_URL")
        self._database_path = Path(self._tmpdir.name) / "economic_upheaval.db"
        os.environ["DATABASE_URL"] = str(self._database_path)
        get_engine.cache_clear()
        self._seed_legacy_workflows_table()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        engine = get_engine()
        self.client.close()
        engine.dispose()
        get_engine.cache_clear()
        if self._previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self._previous_database_url
        try:
            self._tmpdir.cleanup()
        except PermissionError:
            pass

    def _seed_legacy_workflows_table(self) -> None:
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._database_path) as conn:
            conn.execute(
                """
                CREATE TABLE workflows (
                    workflow_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_name VARCHAR(255) NOT NULL,
                    workflow_stage VARCHAR(255) NOT NULL,
                    model_family VARCHAR(64) NOT NULL,
                    model VARCHAR(255),
                    groups JSON NOT NULL,
                    prompt_spec JSON NOT NULL,
                    status VARCHAR(64) NOT NULL DEFAULT 'draft',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                INSERT INTO workflows (
                    workflow_name,
                    workflow_stage,
                    model_family,
                    model,
                    groups,
                    prompt_spec,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Legacy Dashboard Workflow",
                    "Iteration 1",
                    "gemini",
                    "gemini-3-flash-preview",
                    "[]",
                    "{}",
                    "draft",
                ),
            )
            conn.commit()

    def test_dashboard_loads_legacy_database_schema(self) -> None:
        response = self.client.get("/api/dashboard")

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["workflow_count"], 1)
        self.assertEqual(body["workflows"][0]["workflow_name"], "Legacy Dashboard Workflow")
        self.assertIsNone(body["workflows"][0]["sample_set_id"])


if __name__ == "__main__":
    unittest.main()
