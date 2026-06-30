from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.dependencies import get_engine
from backend.api.main import app


class WorkflowCreateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._previous_database_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = str(Path(self._tmpdir.name) / "economic_upheaval.db")
        get_engine.cache_clear()
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
        self._tmpdir.cleanup()

    def test_create_workflow_persists_integer_primary_key(self) -> None:
        payload = {
            "workflow_name": "Test Workflow",
            "workflow_stage": "draft",
            "model_family": "gemini",
            "model": "gemini-3-flash-preview",
            "groups": [],
            "prompt_spec": {
                "instructions": "test",
                "examples": [],
                "inputs": {
                    "sample_ids": [],
                    "selection_mode": "batch",
                    "batch_size": 5,
                },
                "output_format": {"type": "plain_text"},
            },
            "sample_ids": [],
            "status": "draft",
        }

        response = self.client.post("/api/workflows", json=payload)

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertIsInstance(body["workflow_id"], int)
        self.assertEqual(body["workflow_name"], "Test Workflow")
        self.assertEqual(body["workflow_stage"], "draft")


if __name__ == "__main__":
    unittest.main()
