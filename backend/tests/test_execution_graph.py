from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sqlalchemy import insert, select, update

from backend.api import dependencies as _table_registry  # noqa: F401
from backend.database.engine import make_engine
from backend.database.repositories.execution_jobs_repository import ExecutionJobsRepository
from backend.database.repositories.prompt_resolution_repository import PromptResolutionRepository
from backend.database.schema import metadata
from backend.database.tables.documents_table import documents
from backend.database.tables.derivatives_table import derivatives
from backend.database.tables.execution_job_dependencies_table import execution_job_dependencies
from backend.database.tables.execution_jobs_table import execution_jobs
from backend.database.tables.raw_outputs_table import raw_outputs
from backend.database.tables.sample_set_samples_table import sample_set_samples
from backend.database.tables.sample_sets_table import sample_sets
from backend.database.tables.samples_table import samples
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes
from backend.database.tables.workflow_steps_table import workflow_steps
from backend.database.tables.step_outputs_table import step_outputs
from backend.database.tables.workflows_table import workflows
from backend.services.execution_graph_resolver import ExecutionGraphResolver
from backend.services.output_validator import OutputValidator
from backend.services.step_executor_catalog import seed_step_executors


class ExecutionGraphTests(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.engine = make_engine(Path(directory.name) / "graph.db")
        self.addCleanup(self.engine.dispose)
        metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            seed_step_executors(connection)
            connection.execute(insert(sample_sets).values(id=1, name="set"))
            connection.execute(insert(documents), [
                {"id": "doc-1", "name": "Document 1"},
                {"id": "doc-2", "name": "Document 2"},
            ])
            connection.execute(insert(samples), [
                {"id": "s1", "name": "s1", "document_id": "doc-1", "document_position": 0},
                {"id": "s2", "name": "s2", "document_id": "doc-1", "document_position": 1},
                {"id": "s3", "name": "s3", "document_id": "doc-2", "document_position": 0},
            ])
            connection.execute(insert(derivatives), [
                {"id": 11, "name": "doc-1_s1_crop", "sample_id": "s1", "blob": b"1", "mime_type": "image/png"},
                {"id": 12, "name": "doc-1_s2_crop", "sample_id": "s2", "blob": b"2", "mime_type": "image/png"},
                {"id": 13, "name": "doc-2_s3_crop", "sample_id": "s3", "blob": b"3", "mime_type": "image/png"},
            ])
            connection.execute(insert(sample_set_samples), [
                {"sample_set_id": 1, "sample_id": sample_id, "position": position}
                for position, sample_id in enumerate(("s1", "s2", "s3"))
            ])
            connection.execute(insert(workflows).values(
                id=1,
                name="workflow",
                sample_set_id=1,
                status="finalized",
                execution_mode="continuous",
            ))
            connection.execute(insert(workflow_steps), [
                {
                    "id": step_id,
                    "name": f"step-{step_id}",
                    "step_executor_id": "gemini",
                    "method": "transcribe",
                    "executor_config": {"model": "test"},
                    "execution_scope": (
                        "samples_batch" if step_id == 3 else "documents" if step_id == 4 else "samples"
                    ),
                    "output_scope": (
                        "samples_batch" if step_id == 3 else "documents" if step_id == 4 else "samples"
                    ),
                }
                for step_id in range(1, 5)
            ])
            connection.execute(insert(workflow_dag_nodes), [
                {"id": 1, "workflow_id": 1, "workflow_step_id": 1, "row": 1, "col": 1, "execution_scope": "samples"},
                {"id": 2, "workflow_id": 1, "workflow_step_id": 2, "row": 1, "col": 2, "execution_scope": "samples"},
                {"id": 3, "workflow_id": 1, "workflow_step_id": 3, "row": 2, "col": 2, "execution_scope": "samples_batch"},
                {"id": 4, "workflow_id": 1, "workflow_step_id": 4, "row": 1, "col": 3, "execution_scope": "documents"},
            ])
            connection.execute(insert(workflow_dag_edges), [
                {"workflow_id": 1, "from_workflow_dag_node_id": 1, "to_workflow_dag_node_id": 2},
                {"workflow_id": 1, "from_workflow_dag_node_id": 1, "to_workflow_dag_node_id": 3},
                {"workflow_id": 1, "from_workflow_dag_node_id": 2, "to_workflow_dag_node_id": 4},
                {"workflow_id": 1, "from_workflow_dag_node_id": 3, "to_workflow_dag_node_id": 4},
            ])

    def test_resolves_scopes_depths_and_all_parent_join_dependencies(self) -> None:
        ExecutionGraphResolver(self.engine).resolve(1)
        graph = ExecutionJobsRepository(self.engine).execution_graph(1)
        self.assertEqual([0, 1, 1, 2], [node["topological_depth"] for node in graph["nodes"]])
        self.assertEqual([3, 3, 2, 2], [node["total"] for node in graph["nodes"]])
        self.assertEqual([3, 0, 0, 0], [node["pending"] for node in graph["nodes"]])
        with self.engine.connect() as connection:
            joins = connection.execute(
                select(execution_jobs.c.id, execution_jobs.c.input_key)
                .where(execution_jobs.c.current_workflow_dag_node_id == 4)
                .order_by(execution_jobs.c.input_key)
            ).mappings().all()
            dependency_counts = [
                len(connection.execute(
                    select(execution_job_dependencies.c.depends_on_execution_job_id)
                    .where(execution_job_dependencies.c.execution_job_id == row["id"])
                ).all())
                for row in joins
            ]
        # doc-1 depends on two per-sample jobs plus one batch job from each parent;
        # doc-2 depends on one per-sample and one batch job from each parent.
        self.assertEqual([3, 2], dependency_counts)

    def test_document_job_can_publish_one_json_item_per_sample(self) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(workflow_steps)
                .where(workflow_steps.c.id == 4)
                .values(output_scope="samples")
            )
        ExecutionGraphResolver(self.engine).resolve(1)
        jobs = ExecutionJobsRepository(self.engine).list_for_workflow(1, 4)
        refs_by_document = {
            job["input_key"]: [ref["entity_id"] for ref in job["output_refs"]]
            for job in jobs
        }
        self.assertEqual(["s1", "s2"], refs_by_document["doc-1"])
        self.assertEqual(["s3"], refs_by_document["doc-2"])

    def test_continuous_mode_queues_ready_children(self) -> None:
        ExecutionGraphResolver(self.engine).resolve(1)
        repository = ExecutionJobsRepository(self.engine)
        repository.set_run_status(1, "running")
        roots = repository.list_for_workflow(1, 1)
        repository.queue(1, [row["id"] for row in roots])
        for row in roots:
            repository.complete_job_and_advance({**row, "workflow_run_id": roots[0]["workflow_run_id"]})
        depth_one = repository.list_for_workflow(1, 2) + repository.list_for_workflow(1, 3)
        self.assertTrue(depth_one)
        self.assertTrue(all(row["status"] == "queued" for row in depth_one))

    def test_stage_by_stage_waits_for_every_job_at_the_previous_depth(self) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(workflows)
                .where(workflows.c.id == 1)
                .values(execution_mode="stage_by_stage")
            )
        ExecutionGraphResolver(self.engine).resolve(1)
        repository = ExecutionJobsRepository(self.engine)
        repository.set_run_status(1, "running")
        roots = repository.list_for_workflow(1, 1)
        repository.queue(1, [row["id"] for row in roots])
        repository.complete_job_and_advance(roots[0])
        self.assertTrue(
            all(
                row["status"] == "blocked"
                for row in repository.list_for_workflow(1, 2)
                + repository.list_for_workflow(1, 3)
            )
        )
        for row in roots[1:]:
            repository.complete_job_and_advance(row)
        self.assertTrue(
            all(
                row["status"] == "queued"
                for row in repository.list_for_workflow(1, 2)
                + repository.list_for_workflow(1, 3)
            )
        )

    def test_batch_output_requires_exact_stable_entity_ids(self) -> None:
        validator = OutputValidator(self.engine)
        valid = validator.resolve(
            raw_response='{"s1":{"text":"a"},"s2":{"text":"b"}}',
            output_spec={"item_schema": {"type": "object", "properties": {}}},
            execution_scope="samples_batch",
            entity_ids=["s1", "s2"],
        )
        invalid = validator.resolve(
            raw_response='{"s1":{"text":"a"}}',
            output_spec={"item_schema": {"type": "object", "properties": {}}},
            execution_scope="samples_batch",
            entity_ids=["s1", "s2"],
        )
        self.assertEqual("success", valid.parse_status)
        self.assertEqual("failed", invalid.parse_status)

    def test_batch_success_publishes_one_output_per_stable_entity(self) -> None:
        from datetime import datetime, timezone

        ExecutionGraphResolver(self.engine).resolve(1)
        job = ExecutionJobsRepository(self.engine).list_for_workflow(1, 3)[0]
        entity_ids = job["output_entity_ids"]
        response_body = {
            entity_id: f"output-{entity_id}" for entity_id in entity_ids
        }
        import json

        validator = OutputValidator(self.engine)
        resolved = validator.resolve(
            raw_response=json.dumps(response_body),
            output_spec={"item_schema": {"type": "string"}},
            execution_scope=job["execution_scope"],
            output_scope=job["output_scope"],
            entity_ids=entity_ids,
        )
        now = datetime.now(timezone.utc)
        raw_output_id, output_ids = validator.persist(
            execution_job=job,
            workflow_step_id=job["workflow_step_id"],
            response=resolved,
            assembled_payload={},
            started_at=now,
            completed_at=now,
            time_elapsed=0.1,
        )
        with self.engine.connect() as connection:
            attempt_count = connection.execute(
                select(raw_outputs.c.id).where(raw_outputs.c.id == raw_output_id)
            ).all()
            published = connection.execute(
                select(step_outputs.c.entity_key, step_outputs.c.output)
                .where(step_outputs.c.id.in_(output_ids))
                .order_by(step_outputs.c.entity_key)
            ).all()
        self.assertEqual(1, len(attempt_count))
        self.assertEqual(
            sorted((entity_id, f"output-{entity_id}") for entity_id in entity_ids),
            [(row.entity_key, row.output) for row in published],
        )

    def test_document_prompt_resource_is_scoped_to_the_job_document(self) -> None:
        ExecutionGraphResolver(self.engine).resolve(1)
        job = ExecutionJobsRepository(self.engine).list_for_workflow(1, 4)[0]
        rows = PromptResolutionRepository(self.engine).list_prompt_resource_rows(
            {
                "type": "binding",
                "source_table": "documents",
                "name": "documents",
            },
            {},
            execution_job_id=int(job["id"]),
            workflow_id=1,
        )
        self.assertEqual([job["entity_ids"][0]], [row["id"] for row in rows])

    def test_document_binding_includes_every_related_derivative(self) -> None:
        ExecutionGraphResolver(self.engine).resolve(1)
        jobs = ExecutionJobsRepository(self.engine).list_for_workflow(1, 4)
        job = next(row for row in jobs if row["entity_ids"] == ["doc-1"])
        rows = PromptResolutionRepository(self.engine).list_prompt_resource_rows(
            {
                "name": "derivatives",
                "type": "binding",
                "source_table": "derivatives",
            },
            {},
            execution_job_id=int(job["id"]),
            workflow_id=1,
        )
        self.assertEqual([11, 12], [row["id"] for row in rows])

    def test_derivative_binding_can_resolve_its_source_document(self) -> None:
        ExecutionGraphResolver(self.engine).resolve(1)
        job = ExecutionJobsRepository(self.engine).list_for_workflow(1, 1)[0]
        with self.engine.begin() as connection:
            connection.execute(
                update(execution_jobs)
                .where(execution_jobs.c.id == job["id"])
                .values(
                    execution_scope="derivatives",
                    input_refs=[{"entity_type": "derivative", "entity_id": "11"}],
                )
            )
        rows = PromptResolutionRepository(self.engine).list_prompt_resource_rows(
            {
                "name": "document",
                "type": "binding",
                "source_table": "documents",
            },
            {},
            execution_job_id=int(job["id"]),
            workflow_id=1,
        )
        self.assertEqual(["doc-1"], [row["id"] for row in rows])


if __name__ == "__main__":
    unittest.main()
