from __future__ import annotations

import asyncio
import unittest
from unittest import mock

from sqlalchemy import create_engine, insert, select, update

import backend.api.dependencies  # noqa: F401 - registers table metadata
from backend.database.repositories.execution_rows_repository import (
    ExecutionRowsRepository,
)
from backend.database.schema import metadata
from backend.database.tables.execution_jobs_table import execution_jobs
from backend.database.tables.execution_rows_table import execution_rows
from backend.database.tables.samples_table import samples
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows
from backend.services.clients.stub_client import StubModelClient
from backend.services.model_client_factory import ModelClientFactory
from backend.services.payload_builder import PayloadBuilder


class PayloadBuilderTests(unittest.TestCase):
    def test_build_returns_only_interpolated_json(self) -> None:
        builder = PayloadBuilder.__new__(PayloadBuilder)
        builder.repository = _PromptRepository()

        payload = builder.build(
            workflow_id=1,
            sample_id="sample-1",
            workflow_dag_node_id=1,
        )

        self.assertEqual(
            {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": "Read the sample"},
                            {
                                "inline_data": {
                                    "mime_type": "image/png",
                                    "data": b"image bytes",
                                }
                            },
                        ],
                    }
                ]
            },
            payload,
        )


class ExecutionLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", future=True)
        metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            connection.execute(
                insert(workflows).values(
                    workflow_id=1,
                    workflow_name="workflow",
                    status="finalized",
                )
            )
            connection.execute(
                insert(samples).values(sample_id="sample-1", sample_name="sample")
            )
            connection.execute(
                insert(workflow_steps),
                [
                    {
                        "workflow_step_id": 1,
                        "step_name": "first",
                        "model_family": "gemini",
                        "model": "gemini-3.1-flash-lite",
                        "payload_template_id": 1,
                        "output_spec_id": 1,
                        "status": "active",
                    },
                    {
                        "workflow_step_id": 2,
                        "step_name": "second",
                        "model_family": "gemini",
                        "model": "gemini-3.1-flash-lite",
                        "payload_template_id": 1,
                        "output_spec_id": 1,
                        "status": "active",
                    },
                ],
            )
            connection.execute(
                insert(workflow_dag_nodes),
                [
                    {
                        "workflow_dag_node_id": 1,
                        "workflow_id": 1,
                        "workflow_step_id": 1,
                    },
                    {
                        "workflow_dag_node_id": 2,
                        "workflow_id": 1,
                        "workflow_step_id": 2,
                    },
                ],
            )
            connection.execute(
                insert(workflow_dag_edges).values(
                    workflow_dag_edge_id=1,
                    workflow_id=1,
                    from_workflow_dag_node_id=1,
                    to_workflow_dag_node_id=2,
                )
            )
            connection.execute(
                insert(execution_rows).values(
                    execution_row_id=1,
                    workflow_id=1,
                    sample_id="sample-1",
                    status="queued",
                )
            )

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_one_job_advances_the_row_to_the_next_node(self) -> None:
        repository = ExecutionRowsRepository(self.engine)
        row = repository.claim_next_row()
        assert row is not None

        job = repository.start_job_for_row(row)
        self.assertEqual(1, job["workflow_step_id"])
        self.assertEqual("queued", repository.complete_job_and_advance_row(job))

        next_row = repository.claim_next_row()
        assert next_row is not None
        self.assertEqual(2, next_row["current_workflow_dag_node_id"])
        with self.engine.connect() as connection:
            statuses = connection.execute(select(execution_jobs.c.status)).scalars().all()
        self.assertEqual(["completed"], statuses)

    def test_queue_retries_a_pending_row_with_a_failed_job(self) -> None:
        repository = ExecutionRowsRepository(self.engine)
        with self.engine.begin() as connection:
            connection.execute(
                update(execution_rows)
                .where(execution_rows.c.execution_row_id == 1)
                .values(status="pending")
            )
            connection.execute(
                insert(execution_jobs).values(
                    execution_row_id=1,
                    workflow_id=1,
                    sample_id="sample-1",
                    workflow_dag_node_id=1,
                    workflow_step_id=1,
                    status="failed",
                    batch_position=0,
                )
            )

        self.assertEqual(1, repository.queue(1, [1]))
        row = repository.claim_next_row()
        assert row is not None
        job = repository.start_job_for_row(row)

        self.assertEqual(1, job["execution_job_id"])
        self.assertEqual("running", job["status"])

    def test_failed_job_error_is_persisted_and_cleared_when_requeued(self) -> None:
        repository = ExecutionRowsRepository(self.engine)
        row = repository.claim_next_row()
        assert row is not None
        job = repository.start_job_for_row(row)

        repository.set_job_failed(
            int(job["execution_job_id"]),
            1,
            "Stub model failure requested.",
        )
        self.assertEqual(
            "Stub model failure requested.",
            repository.fetch_for_workflow(1, 1)["error_message"],
        )

        self.assertEqual(1, repository.queue(1, [1]))
        self.assertIsNone(repository.fetch_for_workflow(1, 1)["error_message"])

        repository.set_job_failed(
            int(job["execution_job_id"]),
            1,
            "Stub model failure requested.",
        )
        self.assertEqual(1, repository.retry_row(1, 1))
        self.assertIsNone(repository.fetch_for_workflow(1, 1)["error_message"])

    def test_failure_acknowledgements_preserve_rows_and_control_requeueing(self) -> None:
        repository = ExecutionRowsRepository(self.engine)
        row = repository.claim_next_row()
        assert row is not None
        job = repository.start_job_for_row(row)
        repository.set_job_failed(
            int(job["execution_job_id"]), 1, "Stub model failure requested."
        )

        repository.acknowledge_failure(1, 1, "skip")
        skipped_row = repository.fetch_for_workflow(1, 1)
        assert skipped_row is not None
        self.assertEqual("pending", skipped_row["status"])
        self.assertEqual("Stub model failure requested.", skipped_row["error_message"])
        self.assertEqual("failed", repository.list_jobs_for_row(1, 1)[0]["status"])

        repository.acknowledge_failure(1, 1, "stop_execution")
        stopped_row = repository.fetch_for_workflow(1, 1)
        assert stopped_row is not None
        self.assertEqual("queued", stopped_row["status"])
        self.assertEqual("failed", repository.list_jobs_for_row(1, 1)[0]["status"])

        self.assertEqual(1, repository.requeue_failed_jobs_for_queued_rows(1))
        self.assertEqual("queued", repository.list_jobs_for_row(1, 1)[0]["status"])

        repository.set_job_failed(
            int(job["execution_job_id"]), 1, "Stub model failure requested."
        )
        repository.acknowledge_failure(1, 1, "retry")
        retried_row = repository.fetch_for_workflow(1, 1)
        assert retried_row is not None
        self.assertEqual("queued", retried_row["status"])
        self.assertIsNone(retried_row["error_message"])
        self.assertEqual("queued", repository.list_jobs_for_row(1, 1)[0]["status"])


class StubModelClientTests(unittest.TestCase):
    def test_stub_accepts_native_prompt_json(self) -> None:
        response = asyncio.run(
            StubModelClient(model="gemini-3.1-flash-lite").transcribe(
                {"contents": [{"role": "user", "parts": [{"text": "hello"}]}]}
            )
        )
        self.assertEqual("Demo transcription output.", response)

    def test_stub_can_be_configured_to_fail(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Stub model failure requested"):
            asyncio.run(
                StubModelClient(model="gemini-3.1-flash-lite", fail=True).transcribe(
                    {"contents": []}
                )
            )

    def test_factory_passes_the_stub_failure_flag(self) -> None:
        with mock.patch.dict("os.environ", {"STUB_MODEL_FAIL": "true"}):
            client = ModelClientFactory(testing_mode=True).for_step(
                {"model_family": "gemini", "model": "gemini-3.1-flash-lite"}
            )
        self.assertIsInstance(client, StubModelClient)
        self.assertTrue(client.fail)


class _PromptRepository:
    def fetch_node(self, workflow_id: int, node_id: int):
        return {"workflow_step_id": 1}

    def fetch_step(self, step_id: int):
        return {"payload_template_id": 1}

    def fetch_template(self, template_id: int):
        return {
            "payload_template": {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": "{{instructions.text}}"},
                            {
                                "inline_data": {
                                    "mime_type": "{{sample.sample_mime_type}}",
                                    "data": "{{sample.sample_blob}}",
                                }
                            },
                        ],
                    }
                ]
            }
        }

    def fetch_sample(self, sample_id: str):
        return {
            "sample_mime_type": "image/png",
            "sample_blob": b"image bytes",
        }

    def list_prompt_resources(self, template_id: int):
        return [{"name": "instructions"}]

    def list_prompt_resource_rows(self, resource, sample):
        return [{"text": "Read the sample"}]
