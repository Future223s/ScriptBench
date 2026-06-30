from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.api.dependencies import get_engine
from backend.api.main import app
from backend.database.repositories.transcription_jobs_repository import (
    TranscriptionJobsRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.services.transcription_job_worker import TranscriptionJobWorker


class WorkspaceJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self._previous_database_url = os.environ.get("DATABASE_URL")
        self._previous_disable_worker = os.environ.get("SCRIPTBENCH_DISABLE_JOB_WORKER")
        os.environ["DATABASE_URL"] = str(Path(self._tmpdir.name) / "economic_upheaval.db")
        os.environ["SCRIPTBENCH_DISABLE_JOB_WORKER"] = "1"
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
        if self._previous_disable_worker is None:
            os.environ.pop("SCRIPTBENCH_DISABLE_JOB_WORKER", None)
        else:
            os.environ["SCRIPTBENCH_DISABLE_JOB_WORKER"] = self._previous_disable_worker
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

    def test_workspace_splits_jobs_by_status(self) -> None:
        self._create_sample("sample-1", "alpha")
        self._create_sample("sample-2", "beta")

        create_grouping_response = self.client.post(
            "/api/groupings",
            json={
                "name": "review",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(create_grouping_response.status_code, 200, create_grouping_response.text)

        assign_values_response = self.client.post(
            "/api/groupings/review/values",
            json={
                "value": "A",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(assign_values_response.status_code, 200, assign_values_response.text)

        create_workflow_response = self.client.post(
            "/api/workflows",
            json={
                "workflow_name": "Workspace Jobs",
                "workflow_stage": "Iteration 1",
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": ["review"],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1", "sample-2"],
                        "selection_mode": "batch",
                        "batch_size": 1,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "sample_ids": ["sample-1", "sample-2"],
                "status": "draft",
            },
        )
        self.assertEqual(create_workflow_response.status_code, 200, create_workflow_response.text)
        workflow_id = create_workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(
            f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        self.assertEqual(create_jobs_response.json()["job_count"], 2)

        first_workspace_response = self.client.get(
            f"/api/workspaces/{workflow_id}?workflow_stage=Iteration%201"
        )
        self.assertEqual(first_workspace_response.status_code, 200, first_workspace_response.text)
        first_workspace = first_workspace_response.json()
        self.assertEqual(len(first_workspace["pending_jobs"]), 2)
        self.assertEqual(len(first_workspace["queued_jobs"]), 0)

        first_job_id = first_workspace["pending_jobs"][0]["job_id"]
        inspect_response = self.client.get(f"/api/transcription-jobs/{first_job_id}")
        self.assertEqual(inspect_response.status_code, 200, inspect_response.text)
        inspect_body = inspect_response.json()
        self.assertEqual(inspect_body["job_id"], first_job_id)
        self.assertEqual(inspect_body["sample_ids"], ["sample-1"])

        patch_response = self.client.patch(
            f"/api/transcription-jobs/{first_job_id}",
            json={"status": "queued"},
        )
        self.assertEqual(patch_response.status_code, 200, patch_response.text)
        self.assertEqual(patch_response.json()["status"], "queued")

        second_workspace_response = self.client.get(
            f"/api/workspaces/{workflow_id}?workflow_stage=Iteration%201"
        )
        self.assertEqual(second_workspace_response.status_code, 200, second_workspace_response.text)
        second_workspace = second_workspace_response.json()
        self.assertEqual(len(second_workspace["pending_jobs"]), 1)
        self.assertEqual(len(second_workspace["queued_jobs"]), 1)

    def test_workspace_event_stream_broadcasts_queue_updates(self) -> None:
        self._create_sample("sample-1", "alpha")

        create_workflow_response = self.client.post(
            "/api/workflows",
            json={
                "workflow_name": "Workspace Events",
                "workflow_stage": "Iteration 1",
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": [],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1"],
                        "selection_mode": "single",
                        "batch_size": 1,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "sample_ids": ["sample-1"],
                "status": "draft",
            },
        )
        self.assertEqual(create_workflow_response.status_code, 200, create_workflow_response.text)
        workflow_id = create_workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(
            f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)

        workspace_response = self.client.get(
            f"/api/workspaces/{workflow_id}?workflow_stage=Iteration%201"
        )
        self.assertEqual(workspace_response.status_code, 200, workspace_response.text)
        job_id = workspace_response.json()["pending_jobs"][0]["job_id"]

        with self.client.websocket_connect("/api/v1/events") as websocket:
            patch_response = self.client.patch(
                f"/api/v1/workflows/{workflow_id}/workspace/jobs/queue",
                json={"job_ids": [job_id]},
            )
            self.assertEqual(patch_response.status_code, 200, patch_response.text)

            event = websocket.receive_json()
            self.assertEqual(event["event"], "job.queued")
            self.assertEqual(event["job_id"], job_id)
            self.assertEqual(event["status"], "queued")

    def test_worker_claims_jobs_in_batches_of_twenty(self) -> None:
        engine = get_engine()
        workflows_repository = WorkflowsRepository(engine)
        transcription_jobs_repository = TranscriptionJobsRepository(engine)
        workflow_id = workflows_repository.insert_workflow(
            workflow_name="Concurrency Test",
            workflow_stage="Iteration 1",
            sample_set_id=None,
            model_family="gemini",
            model="gemini-3-flash-preview",
            groups=[],
            status="draft",
            prompt_spec={"instructions": "Test", "examples": [], "inputs": {}, "output_format": {"type": "plain_text"}},
        )

        inserted_job_ids: list[int] = []
        for index in range(25):
            job_id = transcription_jobs_repository.insert_transcription_job(
                workflow_id=workflow_id,
                resolved_prompt={"contents": []},
                status="queued",
            )
            inserted_job_ids.append(job_id)

        worker = TranscriptionJobWorker(engine=engine, event_hub=None, max_concurrency=20)
        claimed_jobs = worker._claim_next_jobs(limit=worker.max_concurrency)

        self.assertEqual(len(claimed_jobs), 20)
        self.assertEqual([int(job["job_id"]) for job in claimed_jobs], inserted_job_ids[:20])
        self.assertTrue(all(str(job["status"]) == "running" for job in claimed_jobs))

    def test_worker_refills_capacity_as_jobs_finish(self) -> None:
        engine = get_engine()
        worker = TranscriptionJobWorker(engine=engine, event_hub=None, max_concurrency=2)

        claimed_batches = [
            [{"job_id": 1, "workflow_id": 1, "status": "running", "resolved_prompt": {"contents": []}, "sample_ids": []}],
            [{"job_id": 2, "workflow_id": 1, "status": "running", "resolved_prompt": {"contents": []}, "sample_ids": []}],
            [{"job_id": 3, "workflow_id": 1, "status": "running", "resolved_prompt": {"contents": []}, "sample_ids": []}],
            [],
        ]
        claim_calls: list[int] = []
        processed_job_ids: list[int] = []

        async def fake_process(job_payload):
            processed_job_ids.append(int(job_payload["job_id"]))
            if int(job_payload["job_id"]) == 1:
                await asyncio.sleep(0.02)
            else:
                await asyncio.sleep(0)

        def fake_claim_next_jobs(*, limit: int):
            claim_calls.append(limit)
            if claimed_batches:
                return claimed_batches.pop(0)
            return []

        with patch.object(worker, "_claim_next_jobs", side_effect=fake_claim_next_jobs), patch.object(
            worker,
            "_process_job",
            new=AsyncMock(side_effect=fake_process),
        ):
            did_work = asyncio.run(worker._run_once())

        self.assertTrue(did_work)
        self.assertGreaterEqual(len(claim_calls), 3)
        self.assertEqual(claim_calls[0], 2)
        self.assertTrue(all(limit == 1 for limit in claim_calls[1:]))
        self.assertEqual(processed_job_ids, [1, 2, 3])

    def test_workspace_generates_jobs_without_groups(self) -> None:
        self._create_sample("sample-1", "alpha")
        self._create_sample("sample-2", "beta")
        self._create_sample("sample-3", "gamma")

        create_workflow_response = self.client.post(
            "/api/workflows",
            json={
                "workflow_name": "Ungrouped Workspace Jobs",
                "workflow_stage": "Iteration 1",
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": [],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1", "sample-2", "sample-3"],
                        "selection_mode": "batch",
                        "batch_size": 2,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "sample_ids": ["sample-1", "sample-2", "sample-3"],
                "status": "draft",
            },
        )
        self.assertEqual(create_workflow_response.status_code, 200, create_workflow_response.text)
        workflow_id = create_workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(
            f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        self.assertEqual(create_jobs_response.json()["job_count"], 2)

        workspace_response = self.client.get(
            f"/api/workspaces/{workflow_id}?workflow_stage=Iteration%201"
        )
        self.assertEqual(workspace_response.status_code, 200, workspace_response.text)
        workspace = workspace_response.json()
        self.assertEqual(len(workspace["pending_jobs"]), 2)
        self.assertEqual(len(workspace["queued_jobs"]), 0)
        self.assertEqual(workspace["pending_jobs"][0]["sample_ids"], ["sample-1", "sample-2"])
        self.assertEqual(workspace["pending_jobs"][1]["sample_ids"], ["sample-3"])

    def test_workspace_generates_one_job_per_sample_in_single_mode_without_groups(self) -> None:
        self._create_sample("sample-1", "alpha")
        self._create_sample("sample-2", "beta")

        create_workflow_response = self.client.post(
            "/api/workflows",
            json={
                "workflow_name": "Ungrouped Single Workspace Jobs",
                "workflow_stage": "Iteration 1",
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": [],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1", "sample-2"],
                        "selection_mode": "single",
                        "batch_size": 5,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "sample_ids": ["sample-1", "sample-2"],
                "status": "draft",
            },
        )
        self.assertEqual(create_workflow_response.status_code, 200, create_workflow_response.text)
        workflow_id = create_workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(
            f"/api/workspaces/{workflow_id}/jobs?workflow_stage=Iteration%201"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        self.assertEqual(create_jobs_response.json()["job_count"], 2)

        workspace_response = self.client.get(
            f"/api/workspaces/{workflow_id}?workflow_stage=Iteration%201"
        )
        self.assertEqual(workspace_response.status_code, 200, workspace_response.text)
        workspace = workspace_response.json()
        self.assertEqual(len(workspace["pending_jobs"]), 2)
        self.assertEqual(workspace["pending_jobs"][0]["sample_ids"], ["sample-1"])
        self.assertEqual(workspace["pending_jobs"][1]["sample_ids"], ["sample-2"])

    def test_v1_workspace_jobs_stay_within_group_membership_batches(self) -> None:
        sample_ids = [f"sample-{index}" for index in range(1, 7)]
        for sample_id in sample_ids:
            self._create_sample(sample_id, sample_id)

        for group_name in ("review", "source"):
            grouping_response = self.client.post(
                "/api/groupings",
                json={
                    "name": group_name,
                    "sample_ids": sample_ids,
                },
            )
            self.assertEqual(grouping_response.status_code, 200, grouping_response.text)

        review_assignments = [
            ("A", sample_ids[:5]),
            ("B", sample_ids[5:]),
        ]
        for value, assigned_sample_ids in review_assignments:
            response = self.client.post(
                "/api/groupings/review/values",
                json={
                    "value": value,
                    "sample_ids": assigned_sample_ids,
                },
            )
            self.assertEqual(response.status_code, 200, response.text)

        source_assignments = [
            ("X", sample_ids[:3] + sample_ids[5:]),
            ("Y", sample_ids[3:5]),
        ]
        for value, assigned_sample_ids in source_assignments:
            response = self.client.post(
                "/api/groupings/source/values",
                json={
                    "value": value,
                    "sample_ids": assigned_sample_ids,
                },
            )
            self.assertEqual(response.status_code, 200, response.text)

        sample_set_response = self.client.post(
            "/api/v1/sample-sets",
            json={
                "name": "Grouped Workspace Jobs",
                "sample_ids": sample_ids,
            },
        )
        self.assertEqual(sample_set_response.status_code, 200, sample_set_response.text)
        sample_set_id = sample_set_response.json()["sample_set_id"]

        workflow_response = self.client.post(
            "/api/v1/workflows",
            json={
                "workflow_name": "Grouped Workspace Jobs",
                "workflow_stage": "Iteration 1",
                "sample_set_id": sample_set_id,
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": ["review", "source"],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": sample_ids,
                        "selection_mode": "batch",
                        "batch_size": 5,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "status": "draft",
            },
        )
        self.assertEqual(workflow_response.status_code, 200, workflow_response.text)
        workflow_id = workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(
            f"/api/v1/workflows/{workflow_id}/workspace/jobs"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        body = create_jobs_response.json()
        self.assertEqual(body["job_count"], 3)
        self.assertEqual(
            [job["sample_ids"] for job in body["jobs"]],
            [
                ["sample-1", "sample-2", "sample-3"],
                ["sample-4", "sample-5"],
                ["sample-6"],
            ],
        )

    def test_v1_workspace_jobs_normalize_string_groups(self) -> None:
        sample_ids = ["sample-1", "sample-2", "sample-3"]
        for sample_id in sample_ids:
            self._create_sample(sample_id, sample_id)

        grouping_response = self.client.post(
            "/api/groupings",
            json={
                "name": "EMMO Sample",
                "sample_ids": sample_ids,
            },
        )
        self.assertEqual(grouping_response.status_code, 200, grouping_response.text)

        value_response = self.client.post(
            "/api/groupings/EMMO%20Sample/values",
            json={
                "value": "A",
                "sample_ids": sample_ids,
            },
        )
        self.assertEqual(value_response.status_code, 200, value_response.text)

        sample_set_response = self.client.post(
            "/api/v1/sample-sets",
            json={
                "name": "String Groups Sample Set",
                "sample_ids": sample_ids,
            },
        )
        self.assertEqual(sample_set_response.status_code, 200, sample_set_response.text)
        sample_set_id = sample_set_response.json()["sample_set_id"]

        workflow_response = self.client.post(
            "/api/v1/workflows",
            json={
                "workflow_name": "String Groups Workflow",
                "workflow_stage": "Iteration 1",
                "sample_set_id": sample_set_id,
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": ["EMMO Sample"],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": sample_ids,
                        "selection_mode": "batch",
                        "batch_size": 5,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "status": "draft",
            },
        )
        self.assertEqual(workflow_response.status_code, 200, workflow_response.text)
        workflow_id = workflow_response.json()["workflow_id"]

        engine = get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE workflows SET groups = :groups WHERE workflow_id = :workflow_id"),
                {"groups": json.dumps("EMMO Sample"), "workflow_id": workflow_id},
            )

        create_jobs_response = self.client.post(
            f"/api/v1/workflows/{workflow_id}/workspace/jobs"
        )
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        body = create_jobs_response.json()
        self.assertEqual(body["workflow_groups"], ["EMMO Sample"])
        self.assertEqual(body["job_count"], 1)
        self.assertEqual(body["jobs"][0]["sample_ids"], sample_ids)

    def test_v1_workspace_backfills_legacy_transcriptions_job_id_column(self) -> None:
        legacy_tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        legacy_database_path = Path(legacy_tmpdir.name) / "economic_upheaval.db"
        legacy_database_url = str(legacy_database_path)
        previous_database_url = os.environ.get("DATABASE_URL")

        try:
            with sqlite3.connect(legacy_database_path) as conn:
                conn.execute(
                    """
                    CREATE TABLE transcriptions (
                        transcription_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        workflow_id INTEGER NOT NULL,
                        sample_id VARCHAR(255),
                        transcription_text TEXT NOT NULL,
                        metrics JSON,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        sample_ids JSON,
                        sample_set_id INTEGER
                    )
                    """
                )
                conn.commit()

            os.environ["DATABASE_URL"] = legacy_database_url
            get_engine.cache_clear()

            with TestClient(app) as legacy_client:
                for sample_id, ground_truth_text in [("sample-1", "alpha"), ("sample-2", "beta")]:
                    response = legacy_client.post(
                        "/api/v1/samples",
                        data={
                            "sample_id": sample_id,
                            "ground_truth_text": ground_truth_text,
                        },
                        files={
                            "file": (f"{sample_id}.png", b"fake-image", "image/png"),
                        },
                    )
                    self.assertEqual(response.status_code, 200, response.text)

                sample_set_response = legacy_client.post(
                    "/api/v1/sample-sets",
                    json={
                        "name": "Legacy Workspace",
                        "sample_ids": ["sample-1", "sample-2"],
                    },
                )
                self.assertEqual(sample_set_response.status_code, 200, sample_set_response.text)
                sample_set_id = sample_set_response.json()["sample_set_id"]

                workflow_response = legacy_client.post(
                    "/api/v1/workflows",
                    json={
                        "workflow_name": "Legacy Workspace",
                        "workflow_stage": "Iteration 1",
                        "sample_set_id": sample_set_id,
                        "model_family": "gemini",
                        "model": "gemini-3-flash-preview",
                        "groups": [],
                        "prompt_spec": {
                            "instructions": "Transcribe the image.",
                            "examples": [],
                            "inputs": {
                                "sample_ids": ["sample-1", "sample-2"],
                                "selection_mode": "batch",
                                "batch_size": 1,
                            },
                            "output_format": {"type": "plain_text"},
                        },
                        "status": "draft",
                    },
                )
                self.assertEqual(workflow_response.status_code, 200, workflow_response.text)
                workflow_id = workflow_response.json()["workflow_id"]

                workspace_response = legacy_client.get(
                    f"/api/v1/workflows/{workflow_id}/workspace"
                )
                self.assertEqual(workspace_response.status_code, 200, workspace_response.text)
                workspace = workspace_response.json()
                self.assertEqual(workspace["workflow"]["workflow_id"], workflow_id)
                self.assertEqual(workspace["transcriptions"], [])
        finally:
            legacy_engine = get_engine()
            legacy_engine.dispose()
            get_engine.cache_clear()
            if previous_database_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous_database_url
            legacy_tmpdir.cleanup()

    def test_v1_workspace_delete_all_jobs_clears_the_panel(self) -> None:
        self._create_sample("sample-1", "alpha")
        self._create_sample("sample-2", "beta")

        sample_set_response = self.client.post(
            "/api/v1/sample-sets",
            json={
                "name": "Delete All Workspace",
                "sample_ids": ["sample-1", "sample-2"],
            },
        )
        self.assertEqual(sample_set_response.status_code, 200, sample_set_response.text)
        sample_set_id = sample_set_response.json()["sample_set_id"]

        workflow_response = self.client.post(
            "/api/v1/workflows",
            json={
                "workflow_name": "Delete All Workspace",
                "workflow_stage": "Iteration 1",
                "sample_set_id": sample_set_id,
                "model_family": "gemini",
                "model": "gemini-3-flash-preview",
                "groups": [],
                "prompt_spec": {
                    "instructions": "Transcribe the image.",
                    "examples": [],
                    "inputs": {
                        "sample_ids": ["sample-1", "sample-2"],
                        "selection_mode": "batch",
                        "batch_size": 1,
                    },
                    "output_format": {"type": "plain_text"},
                },
                "status": "draft",
            },
        )
        self.assertEqual(workflow_response.status_code, 200, workflow_response.text)
        workflow_id = workflow_response.json()["workflow_id"]

        create_jobs_response = self.client.post(f"/api/v1/workflows/{workflow_id}/workspace/jobs")
        self.assertEqual(create_jobs_response.status_code, 200, create_jobs_response.text)
        self.assertEqual(create_jobs_response.json()["job_count"], 2)

        delete_jobs_response = self.client.delete(
            f"/api/v1/workflows/{workflow_id}/workspace/jobs?kind=pending"
        )
        self.assertEqual(delete_jobs_response.status_code, 200, delete_jobs_response.text)
        self.assertEqual(delete_jobs_response.json()["transcription_jobs_deleted"], 2)

        workspace_response = self.client.get(f"/api/v1/workflows/{workflow_id}/workspace")
        self.assertEqual(workspace_response.status_code, 200, workspace_response.text)
        workspace = workspace_response.json()
        self.assertEqual(len(workspace["pending_jobs"]), 0)
        self.assertEqual(len(workspace["queued_jobs"]), 0)
        self.assertEqual(len(workspace["transcriptions"]), 0)


if __name__ == "__main__":
    unittest.main()
