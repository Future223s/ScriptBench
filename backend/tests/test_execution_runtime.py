from __future__ import annotations
from backend.services.dev_settings import DevSettings

import asyncio
import unittest
from unittest import mock
from datetime import datetime, timezone

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
from backend.database.tables.raw_outputs_table import raw_outputs
from backend.database.tables.step_outputs_table import step_outputs
from backend.services.output_validator import OutputValidator
from backend.services.clients.stub_client import StubModelClient
from backend.services.step_executor_factory import StepExecutorFactory
from backend.services.payload_builder import PayloadBuilder
from backend.services.output_contract import inject_output_contract


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

    def test_runtime_appends_exact_json_output_contract(self) -> None:
        payload = inject_output_contract(
            {"contents": [{"role": "user", "parts": [{"text": "Read"}]}]},
            model_family="gemini",
            output_spec={"item_schema": {"type": "string"}, "instructions": "Transcribe literally."},
            output_refs=[
                {"entity_type": "sample", "entity_id": "page-1"},
                {"entity_type": "sample", "entity_id": "page-2"},
            ],
        )
        instruction = payload["contents"][0]["parts"][-1]["text"]
        self.assertIn('["page-1", "page-2"]', instruction)
        self.assertIn('"type": "string"', instruction)
        self.assertEqual(
            ["page-1", "page-2"],
            payload["_scriptbench_output_contract"]["entity_ids"],
        )


class ExecutionLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile
        from pathlib import Path
        from backend.database.engine import make_engine
        from backend.database.tables.sample_sets_table import sample_sets
        from backend.database.tables.sample_set_samples_table import sample_set_samples
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
            connection.execute(insert(sample_set_samples).values(
                sample_set_id=1, sample_id='sample-1', position=0))
            connection.execute(insert(workflows).values(
                id=1, name='workflow', sample_set_id=1, status='finalized'))
            connection.execute(insert(workflow_steps), [
                {'id': i, 'name': f'step-{i}', 'step_executor_id': 'gemini',
                 'method': 'transcribe', 'executor_config': {'model': 'test'}}
                for i in (1, 2, 3, 4)
            ])
            connection.execute(insert(workflow_dag_nodes), [
                {'id': 1, 'workflow_id': 1, 'workflow_step_id': 1, 'row': 1, 'col': 1},
                {'id': 2, 'workflow_id': 1, 'workflow_step_id': 2, 'row': 2, 'col': 2},
                {'id': 3, 'workflow_id': 1, 'workflow_step_id': 3, 'row': 1, 'col': 1},
                {'id': 4, 'workflow_id': 1, 'workflow_step_id': 4, 'row': 2, 'col': 2},
            ])
            connection.execute(insert(workflow_dag_edges), [
                {'workflow_id': 1, 'from_workflow_dag_node_id': 1, 'to_workflow_dag_node_id': 3},
                {'workflow_id': 1, 'from_workflow_dag_node_id': 2, 'to_workflow_dag_node_id': 4},
            ])
        self.repository = ExecutionJobsRepository(self.engine)
        self.repository.create_jobs(workflow_id=1, sample_ids=['sample-1'])
        self.repository.set_run_status(1, 'running')
        roots = [row['id'] for row in self.repository.list_for_workflow(1) if row['status'] == 'pending']
        self.repository.queue(1, roots)

    def test_continuous_mode_prioritizes_an_end_to_end_path(self):
        executed_steps = []
        for expected_step_id in (1, 3, 2, 4):
            job = self.repository.claim_next_job()
            self.assertIsNotNone(job)
            self.assertEqual(expected_step_id, job['workflow_step_id'])
            executed_steps.append(job['workflow_step_id'])
            self.assertEqual('completed', self.repository.complete_job_and_advance(job))
        self.assertIsNone(self.repository.claim_next_job())
        self.assertEqual(4, len(self.repository.list_for_workflow(1)))
        self.assertEqual([1, 3, 2, 4], executed_steps)

    def test_job_creation_is_idempotent(self):
        self.repository.create_jobs(workflow_id=1, sample_ids=['sample-1'])
        self.assertEqual(4, len(self.repository.list_for_workflow(1)))

    def test_failed_job_error_is_cleared_when_requeued(self):
        job = self.repository.claim_next_job()
        self.repository.set_job_failed(job['id'], 'Stub model failure requested.')
        failed = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('pending', failed['status'])
        self.assertEqual('Stub model failure requested.', failed['error_message'])
        self.assertEqual(1, self.repository.queue(1, [job['id']]))
        self.repository.set_run_status(1, 'running')
        self.assertIsNone(self.repository.fetch_for_workflow(1, job['id'])['error_message'])
        self.assertEqual('running', self.repository.claim_next_job()['status'])

    def test_failure_acknowledgement_controls_requeueing(self):
        job = self.repository.claim_next_job()
        self.repository.set_job_failed(job['id'], 'Failure')
        self.repository.acknowledge_failure(1, job['id'], 'abort')
        stopped = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('pending', stopped['status'])
        self.assertEqual('Failure', stopped['error_message'])
        self.repository.acknowledge_failure(1, job['id'], 'retry')
        retried = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('queued', retried['status'])
        self.assertIsNone(retried['error_message'])
        self.repository.set_job_failed(job['id'], 'Failure again')
        self.repository.acknowledge_failure(1, job['id'], 'skip')
        skipped = self.repository.fetch_for_workflow(1, job['id'])
        self.assertEqual('pending', skipped['status'])
        self.assertIsNone(skipped['error_message'])

    def test_restart_recovers_running_jobs(self):
        self.repository.claim_next_job()
        self.assertEqual(1, self.repository.recover_interrupted_jobs())
        self.assertEqual('pending', self.repository.fetch_for_workflow(1, 1)['status'])

    def test_foreign_keys_reject_missing_samples_and_cascade_deletes(self):
        from sqlalchemy import delete
        from sqlalchemy.exc import IntegrityError
        with self.engine.begin() as connection:
            connection.execute(delete(samples).where(samples.c.id == 'sample-1'))
        self.assertEqual([], self.repository.list_for_workflow(1))

    def test_raw_attempts_are_append_only_and_only_success_is_published(self):
        validator = OutputValidator(self.engine)
        job = self.repository.list_for_workflow(1, 1)[0]
        now = datetime.now(timezone.utc)

        failed = validator.resolve(
            raw_response="not-json",
            output_spec={"item_schema": {"type": "object", "properties": {}}},
            execution_scope=job["execution_scope"],
            output_scope=job["output_scope"],
            entity_ids=job["output_entity_ids"],
        )
        validator.persist(
            execution_job=job,
            workflow_step_id=job["workflow_step_id"],
            response=failed,
            assembled_payload={"attempt": 1},
            started_at=now,
            completed_at=now,
            time_elapsed=0.1,
        )

        succeeded = validator.resolve(
            raw_response='{"sample-1":{"text":"accepted"}}',
            output_spec={"item_schema": {"type": "object", "properties": {}}},
            execution_scope=job["execution_scope"],
            output_scope=job["output_scope"],
            entity_ids=job["output_entity_ids"],
        )
        validator.persist(
            execution_job=job,
            workflow_step_id=job["workflow_step_id"],
            response=succeeded,
            assembled_payload={"attempt": 2},
            started_at=now,
            completed_at=now,
            time_elapsed=0.2,
        )

        with self.engine.connect() as connection:
            attempts = connection.execute(
                select(raw_outputs)
                .where(raw_outputs.c.execution_job_id == job["id"])
                .order_by(raw_outputs.c.attempt_no)
            ).mappings().all()
            published = connection.execute(
                select(step_outputs).where(
                    step_outputs.c.execution_job_id == job["id"]
                )
            ).mappings().all()

        self.assertEqual([1, 2], [row["attempt_no"] for row in attempts])
        self.assertEqual(["failed", "success"], [row["parse_status"] for row in attempts])
        self.assertEqual(1, len(published))
        self.assertEqual(attempts[1]["id"], published[0]["raw_output_id"])
        self.assertEqual({"text": "accepted"}, published[0]["output"])

    def test_object_item_shape_enforces_property_required_flags(self):
        validator = OutputValidator(self.engine)
        shape = {
            "type": "object",
            "properties": {
                "text": {"type": "string", "required": True},
                "confidence": {"type": "number", "required": False},
            },
        }
        valid = validator.resolve(
            raw_response='{"sample-1":{"text":"accepted"}}',
            output_spec={"item_schema": shape},
            entity_ids=["sample-1"],
        )
        invalid = validator.resolve(
            raw_response='{"sample-1":{"confidence":0.9}}',
            output_spec={"item_schema": shape},
            entity_ids=["sample-1"],
        )
        self.assertEqual("success", valid.parse_status)
        self.assertEqual("failed", invalid.parse_status)

    def test_document_job_scores_each_sample_output_against_its_ground_truth(self):
        with self.engine.begin() as connection:
            connection.execute(
                update(samples)
                .where(samples.c.id == "sample-1")
                .values(ground_truth_text="first transcription")
            )
            connection.execute(
                insert(samples).values(
                    id="sample-2",
                    name="second sample",
                    ground_truth_text="second transcription",
                )
            )

        validator = OutputValidator(self.engine)
        job = dict(self.repository.list_for_workflow(1, 1)[0])
        job.update(
            execution_scope="documents",
            output_scope="samples",
            sample_id=None,
            output_refs=[
                {"entity_type": "sample", "entity_id": "sample-1"},
                {"entity_type": "sample", "entity_id": "sample-2"},
            ],
        )
        response = validator.resolve(
            raw_response=(
                '{"sample-1":"first transcription",'
                '"sample-2":"second transcription"}'
            ),
            output_spec={"item_schema": {"type": "string"}},
            execution_scope="documents",
            output_scope="samples",
            entity_ids=["sample-1", "sample-2"],
        )
        now = datetime.now(timezone.utc)

        _, output_ids = validator.persist(
            execution_job=job,
            workflow_step_id=job["workflow_step_id"],
            response=response,
            assembled_payload={"contents": []},
            started_at=now,
            completed_at=now,
            time_elapsed=0.1,
        )

        with self.engine.connect() as connection:
            scored = connection.execute(
                select(
                    step_outputs.c.sample_id,
                    step_outputs.c.cer,
                    step_outputs.c.wer,
                )
                .where(step_outputs.c.id.in_(output_ids))
                .order_by(step_outputs.c.sample_id)
            ).mappings().all()

        self.assertEqual(
            [
                {"sample_id": "sample-1", "cer": 0.0, "wer": 0.0},
                {"sample_id": "sample-2", "cer": 0.0, "wer": 0.0},
            ],
            [dict(row) for row in scored],
        )


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

    def list_prompt_resource_rows(self, resource, sample, *args, **kwargs):
        return [{"text": "Read the sample"}]
