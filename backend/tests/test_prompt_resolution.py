from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select, func

from backend.api.dependencies import get_engine
from backend.api.main import app
from backend.database.tables.sample_uploads_table import sample_uploads


class FakeFileRef:
    def __init__(self, sample_id: str) -> None:
        self.uri = f"fake://{sample_id}"
        self.mime_type = "image/png"


class FakeGeminiClient:
    uploaded_sample_ids: list[str] = []

    def __init__(
        self,
        workflow_config,
        image_dir=None,
        cache_registry_path=None,
        image_extensions=None,
    ) -> None:
        self.workflow_config = workflow_config

    async def upload_samples(self, sample_payloads, existing_upload_refs=None, batch_size=50):
        existing_upload_refs = dict(existing_upload_refs or {})
        upload_refs: dict[str, str] = {}
        for sample_id in sample_payloads:
            if sample_id in existing_upload_refs:
                upload_refs[sample_id] = existing_upload_refs[sample_id]
                continue
            FakeGeminiClient.uploaded_sample_ids.append(sample_id)
            upload_refs[sample_id] = f"files/{sample_id}"
        return upload_refs

    async def get_file_refs(self, ref_names):
        return {sample_id: FakeFileRef(sample_id) for sample_id in ref_names}


class PromptResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._previous_database_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = str(Path(self._tmpdir.name) / "economic_upheaval.db")
        get_engine.cache_clear()
        FakeGeminiClient.uploaded_sample_ids = []
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

    def test_job_generation_reuses_persisted_upload_refs(self) -> None:
        self._create_sample("sample-1", "alpha")
        self._create_sample("sample-2", "beta")

        grouping_response = self.client.post(
            "/api/groupings",
            json={
                "name": "line-crops",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(grouping_response.status_code, 200, grouping_response.text)

        value_response = self.client.post(
            "/api/groupings/line-crops/values",
            json={
                "value": "A",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(value_response.status_code, 200, value_response.text)

        workflow_response = self.client.post(
            "/api/workflows",
            json={
                "workflow_name": "Prompt Resolution",
                "workflow_stage": "Iteration 1",
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": ["line-crops"],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1", "sample-2"],
                        "selection_mode": "batch",
                        "batch_size": 5,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "sample_ids": ["sample-1", "sample-2"],
                "status": "draft",
            },
        )
        self.assertEqual(workflow_response.status_code, 200, workflow_response.text)
        workflow_id = workflow_response.json()["workflow_id"]

        with patch("backend.api.routes.workspaces.GeminiClient", FakeGeminiClient):
            first_response = self.client.post(
                f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
            )
            self.assertEqual(first_response.status_code, 200, first_response.text)
            first_body = first_response.json()
            self.assertEqual(first_body["job_count"], 1)
            self.assertEqual(sorted(FakeGeminiClient.uploaded_sample_ids), ["sample-1", "sample-2"])

            engine = get_engine()
            with engine.begin() as conn:
                upload_count = conn.execute(
                    select(func.count()).select_from(sample_uploads)
                ).scalar_one()
            self.assertEqual(upload_count, 2)

            FakeGeminiClient.uploaded_sample_ids = []
            second_response = self.client.post(
                f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
            )
            self.assertEqual(second_response.status_code, 200, second_response.text)
            self.assertEqual(FakeGeminiClient.uploaded_sample_ids, [])

            with engine.begin() as conn:
                upload_count_after_second_run = conn.execute(
                    select(func.count()).select_from(sample_uploads)
                ).scalar_one()
            self.assertEqual(upload_count_after_second_run, 2)


if __name__ == "__main__":
    unittest.main()
