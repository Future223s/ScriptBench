from __future__ import annotations
from backend.services.dev_settings import DevSettings

import asyncio
import unittest
from unittest import mock

from sqlalchemy import create_engine, insert, select, update

import backend.api.dependencies  # noqa: F401 - registers table metadata
from backend.database.repositories.execution_jobs_repository import (
    ExecutionJobsRepository,
)
from backend.database.schema import metadata
from backend.database.tables.execution_jobs_table import execution_jobs
from backend.database.tables.samples_table import samples
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.workflows_table import workflows
from backend.services.clients.stub_client import StubModelClient
from backend.services.step_executor_factory import StepExecutorFactory
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
        import tempfile
        from pathlib import Path
        from backend.database.engine import make_engine
        from backend.database.tables.sample_sets_table import sample_sets
        from backend.services.step_executor_catalog import seed_step_executors
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.engine = make_engine(Path(self.directory.name) / 'runtime.db')
        self.addCleanup(self.engine.dispose)
        metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            seed_step_executors(connection)
            connection.execute(insert(sample_sets).values(id=1, name='set'))
            connection.execute(insert(samples).values(id='sample-1', name='sample'))
            connection.execute(insert(workflows).values(
                id=1, name='workflow', sample_set_id=1, status='finalized'))
            connection.execute(insert(workflow_steps), [
                {'id': i, 'name': f'step-{i}', 'step_executor_id': 'gemini',
                 'method': 'transcribe', 'executor_config': {'model': 'test'}}
                for i in (1, 2)
            ])
            connection.execute(insert(workflow_dag_nodes), [
                {'id': i, 'workflow_id': 1, 'workflow_step_id': i, 'row': 1, 'col': i}
                for i in (1, 2)
            ])
            connection.execute(insert(workflow_dag_edges).values(
                workflow_id=1, from_workflow_dag_node_id=1, to_workflow_dag_node_id=2))
        self.repository = ExecutionJobsRepository(self.engine)
        self.repository.create_jobs(workflow_id=1, sample_ids=['sample-1'])
        self.repository.queue(1, [1])

    def test_same_job_advances_through_both_nodes(self):
        job = self.repository.claim_next_job()
        self.assertEqual(1, job['id'])
        self.assertEqual(1, job['workflow_step_id'])
        self.assertEqual('queued', self.repository.complete_job_and_advance(job))
        next_job = self.repository.claim_next_job()
        self.assertEqual(job['id'], next_job['id'])
        self.assertEqual(2, next_job['current_workflow_dag_node_id'])
        self.assertEqual(2, next_job['workflow_step_id'])
        self.assertEqual('completed', self.repository.complete_job_and_advance(next_job))
        self.assertIsNone(self.repository.claim_next_job())
        self.assertEqual(1, len(self.repository.list_for_workflow(1)))

    def test_job_creation_is_idempotent(self):
        self.repository.create_jobs(workflow_id=1, sample_ids=['sample-1'])
        self.assertEqual(1, len(self.repository.list_for_workflow(1)))

    def test_failed_job_error_is_cleared_when_requeued(self):
        job = self.repository.claim_next_job()
        self.repository.set_job_failed(job['id'], 'Stub model failure requested.')
        failed = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('pending', failed['status'])
        self.assertEqual('Stub model failure requested.', failed['error_message'])
        self.assertEqual(1, self.repository.queue(1, [job['id']]))
        self.assertIsNone(self.repository.fetch_for_workflow(1, job['id'])['error_message'])
        self.assertEqual('running', self.repository.claim_next_job()['status'])

    def test_failure_acknowledgement_controls_requeueing(self):
        job = self.repository.claim_next_job()
        self.repository.set_job_failed(job['id'], 'Failure')
        self.repository.acknowledge_failure(1, job['id'], 'stop_execution')
        stopped = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('pending', stopped['status'])
        self.assertEqual('Failure', stopped['error_message'])
        self.repository.acknowledge_failure(1, job['id'], 'retry')
        retried = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('queued', retried['status'])
        self.assertIsNone(retried['error_message'])
        with self.assertRaises(ValueError):
            self.repository.acknowledge_failure(1, job['id'], 'skip')

    def test_restart_recovers_running_jobs(self):
        self.repository.claim_next_job()
        self.assertEqual(1, self.repository.recover_interrupted_jobs())
        self.assertEqual('pending', self.repository.fetch_for_workflow(1, 1)['status'])

    def test_foreign_keys_reject_missing_samples_and_cascade_deletes(self):
        from sqlalchemy import delete
        from sqlalchemy.exc import IntegrityError
        with self.assertRaises(IntegrityError):
            self.repository.create_jobs(workflow_id=1, sample_ids=['missing'])
        with self.engine.begin() as connection:
            connection.execute(delete(samples).where(samples.c.id == 'sample-1'))
        self.assertEqual([], self.repository.list_for_workflow(1))


class StubModelClientTests(unittest.TestCase):
    def test_stub_accepts_native_prompt_json(self) -> None:
        executor = StubModelClient(model="gemini-3.1-flash-lite")
        response = asyncio.run(
            executor.execute(executor.transcribe,
                {"contents": [{"role": "user", "parts": [{"text": "hello"}]}]}
            )
        )
        self.assertEqual("Demo transcription output.", response)

    def test_stub_can_be_configured_to_fail(self) -> None:
        executor = StubModelClient(model="gemini-3.1-flash-lite", fail=True)
        with self.assertRaisesRegex(RuntimeError, "Stub model failure requested"):
            asyncio.run(
                executor.execute(executor.transcribe,
                    {"contents": []}
                )
            )

    def test_factory_passes_the_stub_failure_flag(self) -> None:
        from sqlalchemy import create_engine
        from backend.database.schema import metadata
        from backend.services.step_executor_catalog import seed_step_executors
        engine = create_engine("sqlite://")
        metadata.create_all(engine)
        self.addCleanup(engine.dispose)
        with engine.begin() as conn:
            seed_step_executors(conn)
        settings = DevSettings(dev=True)
        settings.update(stub_mode=True, stub_fail=True)
        client = StepExecutorFactory(engine, settings=settings).for_step(
            {"step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "gemini-3.1-flash-lite"}}
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
            "payload": {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": "{{instructions.text}}"},
                            {
                                "inline_data": {
                                    "mime_type": "{{sample.mime_type}}",
                                    "data": "{{sample.blob}}",
                                }
                            },
                        ],
                    }
                ]
            }
        }

    def fetch_sample(self, sample_id: str):
        return {
            "mime_type": "image/png",
            "blob": b"image bytes",
        }

    def list_prompt_resources(self, template_id: int):
        return [{"name": "instructions"}]

    def list_prompt_resource_rows(self, resource, sample):
        return [{"text": "Read the sample"}]
