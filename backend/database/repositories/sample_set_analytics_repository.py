from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.engine import Engine

from ..tables.execution_jobs_table import execution_jobs
from ..tables.sample_set_samples_table import sample_set_samples
from ..tables.step_outputs_table import step_outputs
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflows_table import workflows


class SampleSetAnalyticsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_workflows(self, sample_set_id: int) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(workflows)
                    .where(workflows.c.sample_set_id == sample_set_id)
                    .order_by(workflows.c.id)
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def completed_counts(self, workflow_ids: Sequence[int]) -> dict[int, int]:
        if not workflow_ids:
            return {}
        terminal_steps = (
            select(
                workflow_dag_nodes.c.workflow_id,
                workflow_dag_nodes.c.workflow_step_id,
            )
            .outerjoin(
                workflow_dag_edges,
                workflow_dag_edges.c.from_workflow_dag_node_id
                == workflow_dag_nodes.c.id,
            )
            .where(
                workflow_dag_nodes.c.workflow_id.in_(list(workflow_ids)),
                workflow_dag_edges.c.from_workflow_dag_node_id.is_(None),
            )
            .distinct()
            .subquery()
        )
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(
                        step_outputs.c.workflow_id,
                        func.count(func.distinct(step_outputs.c.sample_id)).label(
                            "completed_sample_count"
                        ),
                    )
                    .select_from(
                        step_outputs.join(
                            execution_jobs,
                            execution_jobs.c.id == step_outputs.c.execution_job_id,
                        ).join(
                            terminal_steps,
                            (terminal_steps.c.workflow_id == step_outputs.c.workflow_id)
                            & (terminal_steps.c.workflow_step_id == step_outputs.c.workflow_step_id),
                        ).join(
                            workflows,
                            workflows.c.id == step_outputs.c.workflow_id,
                        ).join(
                            sample_set_samples,
                            (sample_set_samples.c.sample_set_id == workflows.c.sample_set_id)
                            & (sample_set_samples.c.sample_id == step_outputs.c.sample_id),
                        )
                    )
                    .where(
                        step_outputs.c.workflow_id.in_(list(workflow_ids)),
                        execution_jobs.c.status == "completed",
                        step_outputs.c.entity_type == "sample",
                    )
                    .group_by(step_outputs.c.workflow_id)
                )
                .mappings()
                .all()
            )
        return {
            int(row["workflow_id"]): int(row["completed_sample_count"])
            for row in rows
        }

    def list_terminal_metrics(
        self, workflow_ids: Sequence[int]
    ) -> list[dict[str, Any]]:
        if not workflow_ids:
            return []
        final_steps = (
            select(
                workflow_dag_nodes.c.workflow_id,
                workflow_dag_nodes.c.workflow_step_id,
            )
            .outerjoin(
                workflow_dag_edges,
                workflow_dag_edges.c.from_workflow_dag_node_id
                == workflow_dag_nodes.c.id,
            )
            .where(
                workflow_dag_nodes.c.workflow_id.in_(list(workflow_ids)),
                workflow_dag_edges.c.from_workflow_dag_node_id.is_(None),
            )
            .distinct()
            .subquery()
        )
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(
                        execution_jobs.c.workflow_id,
                        step_outputs.c.sample_id,
                        step_outputs.c.cer,
                        step_outputs.c.wer,
                        step_outputs.c.created_at,
                    )
                    .select_from(
                        execution_jobs.join(
                            step_outputs,
                            step_outputs.c.execution_job_id == execution_jobs.c.id,
                        ).join(
                            final_steps,
                            final_steps.c.workflow_id == execution_jobs.c.workflow_id,
                        )
                    )
                    .where(
                        execution_jobs.c.workflow_id.in_(list(workflow_ids)),
                        execution_jobs.c.status == "completed",
                        step_outputs.c.workflow_step_id
                        == final_steps.c.workflow_step_id,
                        step_outputs.c.entity_type == "sample",
                    )
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]
