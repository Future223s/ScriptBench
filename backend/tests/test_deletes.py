from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.dependencies import get_engine
from backend.api.main import app


class DeleteResourceTests(unittest.TestCase):
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

    def _create_sample(self, sample_id: str, ground_truth_text: str = "") -> None:
        response = self.client.post(
            "/api/samples",
            data={
                "sample_id": sample_id,
                "ground_truth_text": ground_truth_text,
            },
            files={
                "file": (f"{sample_id}.png", b"fake-image", "image/png"),
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

    def test_delete_sample_removes_sample(self) -> None:
        self._create_sample("sample-1", "hello")

        response = self.client.delete("/api/samples/sample-1")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["sample_id"], "sample-1")
        self.assertTrue(response.json()["deleted"])

        get_response = self.client.get("/api/samples/sample-1")
        self.assertEqual(get_response.status_code, 404, get_response.text)

    def test_delete_grouping_removes_group_membership(self) -> None:
        self._create_sample("sample-1")
        self._create_sample("sample-2")

        create_response = self.client.post(
            "/api/groupings",
            json={
                "name": "review",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(create_response.status_code, 200, create_response.text)

        delete_response = self.client.delete("/api/groupings/review")

        self.assertEqual(delete_response.status_code, 200, delete_response.text)
        self.assertEqual(delete_response.json()["group_name"], "review")
        self.assertTrue(delete_response.json()["deleted"])
        self.assertEqual(delete_response.json()["updated_samples"], 2)

        groupings_response = self.client.get("/api/groupings")
        self.assertEqual(groupings_response.status_code, 200, groupings_response.text)
        self.assertNotIn("review", [group["name"] for group in groupings_response.json()["groupings"]])

        sample_response = self.client.get("/api/samples/sample-1")
        self.assertEqual(sample_response.status_code, 200, sample_response.text)
        self.assertNotIn("review", sample_response.json()["sample_groups"])


if __name__ == "__main__":
    unittest.main()
