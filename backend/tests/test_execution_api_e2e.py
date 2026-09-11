from __future__ import annotations

import base64
import logging
import os
import tempfile
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.dependencies import get_engine
from backend.api.main import app


logger = logging.getLogger(__name__)
REAL_IMAGE_PATH = (
    Path(__file__).resolve().parents[2]
    / "seed-data"
    / "economic-upheaval"
    / "01_source_material"
    / "EMMO"
    / "images"
    / "La115_1r_EMMO.png"
)


class ExecutionApiEndToEndTests(unittest.TestCase):
    """Exercise the same HTTP boundaries used by the frontend."""

    def setUp(self) -> None:
        self.original_environment = {
            name: os.environ.get(name)
            for name in ("DATABASE_URL", "DEV")
        }
        self.database_file = tempfile.NamedTemporaryFile(
            suffix=".db",
            delete=False,
        )
        self.database_file.close()
        os.environ["DATABASE_URL"] = f"sqlite:///{self.database_file.name}"
        os.environ["DEV"] = "true"
        get_engine.cache_clear()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self) -> None:
        self.client.__exit__(None, None, None)
        get_engine.cache_clear()
        Path(self.database_file.name).unlink(missing_ok=True)
        for name, value in self.original_environment.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def test_frontend_api_can_create_and_complete_an_image_prompt_execution(self) -> None:
        image_bytes = REAL_IMAGE_PATH.read_bytes()
        self.assertTrue(image_bytes.startswith(b"\x89PNG\r\n\x1a\n"))
        logger.info(
            "E2E fixture loaded: %s (%s bytes)",
            REAL_IMAGE_PATH.name,
            len(image_bytes),
        )
        sample_id = "api-e2e-sample"
        self._post(
            "/api/v2/samples",
            {"id": sample_id, "name": "API E2E sample"},
            gate="sample metadata created",
        )
        response = self.client.put(
            f"/api/v2/samples/{sample_id}/blob",
            files={"file": ("sample.png", image_bytes, "image/png")},
        )
        self._assert_response(response, gate="sample image uploaded")

        payload_template = self._post(
            "/api/v2/payload-templates",
            {
                "name": "API E2E image prompt",
                "model_family": "gemini",
                "payload": {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": "What is in this image?"},
                                {
                                    "inline_data": {
                                        "mime_type": "{{sample.mime_type}}",
                                        "data": "{{sample.blob}}",
                                    }
                                },
                            ],
                        }
                    ]
                },
                "resources": [],
            },
            gate="native JSON payload template created",
        )
        output_spec = self._post(
            "/api/v2/output-specs",
            {
                "name": "API E2E plain text",
                "type": "plain-text",
            },
            gate="plain-text output specification created",
        )
        workflow_step = self._post(
            "/api/v2/workflow-steps",
            {
                "name": "API E2E Gemini step",
                "step_executor_id": "gemini",
                "method": "transcribe",
                "executor_config": {"model": "gemini-3.1-flash-lite"},
                "payload_template_id": payload_template["data"]["id"],
                "output_spec_id": output_spec["data"]["id"],
            },
            gate="Gemini workflow step created",
        )
        sample_set = self._post(
            "/api/v2/sample-sets",
            {
                "name": "API E2E set",
                "description": "A single image for API verification.",
                "sample_ids": [sample_id],
            },
            gate="sample set created",
        )
        workflow = self._post(
            "/api/v2/workflows",
            {
                "name": "API E2E workflow",
                "description": "Generate a transcription from the sample image.",
                "sample_set_id": sample_set["data"]["id"],
                "status": "draft",
            },
            gate="workflow created",
        )
        workflow_id = workflow["data"]["id"]
        self._post(
            f"/api/v2/workflows/{workflow_id}/workflow-dag-nodes",
            {
                "workflow_step_id": workflow_step["data"]["id"],
                "row": 1,
                "col": 1,
            },
            gate="workflow step placed in DAG",
        )
        workflow_summaries = self.client.get("/api/v2/workflows")
        self._assert_response(workflow_summaries, gate="workspace metadata available")
        workflow_summary = workflow_summaries.json()["items"][0]
        self.assertEqual("API E2E workflow", workflow_summary["name"])
        self.assertEqual(
            "Generate a transcription from the sample image.",
            workflow_summary["description"],
        )
        response = self.client.patch(f"/api/v2/workflows/{workflow_id}/finalize")
        self._assert_response(response, gate="workflow finalized")

        created_rows = self.client.get(f"/api/v2/workflows/{workflow_id}/execution-jobs")
        self._assert_response(created_rows, gate="execution row created at finalization")
        row = created_rows.json()["items"][0]
        row_id = row["id"]
        self.assertEqual("pending", row["status"])
        logger.info("E2E gate passed: execution row created without a prebuilt job")

        self._post(
            f"/api/v2/workflows/{workflow_id}/execution-jobs/queue",
            {"ids": [row_id]},
            gate="execution row queued",
        )
        queued_rows = self.client.get(
            f"/api/v2/workflows/{workflow_id}/execution-jobs"
        )
        self._assert_response(queued_rows, gate="queued row retrieved")
        self.assertEqual("queued", queued_rows.json()["items"][0]["status"])
        logger.info("E2E gate passed: queue admission does not start execution")

        self._post(
            f"/api/v2/workflows/{workflow_id}/execute",
            {},
            gate="execution started",
        )

        detail = self._wait_for_completed_row(workflow_id, row_id)
        self.assertEqual(row_id, detail["data"]["id"])
        self.assertEqual("completed", detail["data"]["status"])

        step_outputs = detail["data"]["step_outputs"]
        self.assertEqual(1, len(step_outputs), "one completed job must persist one output")
        output = step_outputs[0]
        self.assertEqual("Demo transcription output.", output["raw_model_response"])
        self.assertEqual("success", output["parse_status"])
        self.assertEqual("Demo transcription output.", output["parsed_output"])
        logger.info("E2E gate passed: testing client returned and plaintext was validated")

        assembled_payload = output["assembled_model_payload"]
        inline_data = assembled_payload["contents"][0]["parts"][1]["inline_data"]
        self.assertEqual("image/png", inline_data["mime_type"])
        self.assertEqual(base64.b64encode(image_bytes).decode("ascii"), inline_data["data"])
        logger.info("E2E gate passed: payload JSON interpolated the sample image bytes")

        self.assertEqual("completed", detail["data"]["status"])
        logger.info("E2E gate passed: step output was persisted")

    def _post(self, path: str, payload: dict[str, object], *, gate: str) -> dict:
        response = self.client.post(path, json=payload)
        self._assert_response(response, gate=gate)
        return response.json()

    def _wait_for_completed_row(self, workflow_id: int, row_id: int) -> dict:
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            response = self.client.get(
                f"/api/v2/workflows/{workflow_id}/execution-jobs/{row_id}"
            )
            self._assert_response(response, gate="execution row detail read")
            detail = response.json()
            if detail["data"]["status"] == "completed":
                return detail
            time.sleep(0.05)
        self.fail("execution row did not complete within five seconds")

    def _assert_response(self, response, *, gate: str) -> None:
        self.assertLess(
            response.status_code,
            300,
            f"{gate} failed: {response.status_code} {response.text}",
        )
        logger.info("E2E gate passed: %s", gate)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    unittest.main()
