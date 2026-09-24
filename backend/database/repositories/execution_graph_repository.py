from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from typing import Any

from sqlalchemy import insert, select, update
from sqlalchemy.engine import Connection, Engine

from ..tables.derivatives_table import derivatives
from ..tables.execution_job_dependencies_table import execution_job_dependencies
from ..tables.execution_jobs_table import execution_jobs
from ..tables.sample_set_samples_table import sample_set_samples
from ..tables.samples_table import samples
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_run_nodes_table import workflow_run_nodes
from ..tables.workflow_runs_table import workflow_runs
from ..tables.workflows_table import workflows
from ..tables.workflow_steps_table import workflow_steps


class ExecutionGraphRepository:
    """Database access used while materializing an executable workflow graph."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def transaction(self) -> AbstractContextManager[Connection]:
        return self.engine.begin()

    def fetch_run_id(self, workflow_id: int, *, conn: Connection) -> int | None:
        value = conn.execute(
            select(workflow_runs.c.id).where(
                workflow_runs.c.workflow_id == workflow_id
            )
        ).scalar_one_or_none()
        return int(value) if value is not None else None

    def fetch_workflow(self, workflow_id: int, *, conn: Connection) -> dict[str, Any]:
        row = (
            conn.execute(select(workflows).where(workflows.c.id == workflow_id))
            .mappings()
            .one()
        )
        return dict(row)

    def list_nodes(self, workflow_id: int, *, conn: Connection) -> list[dict[str, Any]]:
        rows = (
            conn.execute(
                select(
                    workflow_dag_nodes.c.id,
                    workflow_dag_nodes.c.workflow_id,
                    workflow_dag_nodes.c.workflow_step_id,
                    workflow_dag_nodes.c.row,
                    workflow_dag_nodes.c.col,
                    workflow_steps.c.execution_scope,
                    workflow_steps.c.output_scope,
                )
                .join(
                    workflow_steps,
                    workflow_steps.c.id == workflow_dag_nodes.c.workflow_step_id,
                )
                .where(workflow_dag_nodes.c.workflow_id == workflow_id)
                .order_by(workflow_dag_nodes.c.id)
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]

    def list_edges(self, workflow_id: int, *, conn: Connection) -> list[dict[str, Any]]:
        rows = (
            conn.execute(
                select(workflow_dag_edges)
                .where(workflow_dag_edges.c.workflow_id == workflow_id)
                .order_by(workflow_dag_edges.c.id)
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]

    def list_samples(
        self, sample_set_id: int, *, conn: Connection
    ) -> list[dict[str, Any]]:
        rows = (
            conn.execute(
                select(samples)
                .join(
                    sample_set_samples,
                    sample_set_samples.c.sample_id == samples.c.id,
                )
                .where(sample_set_samples.c.sample_set_id == sample_set_id)
                .order_by(sample_set_samples.c.position, samples.c.id)
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]

    def list_derivatives(
        self, sample_ids: Sequence[str], *, conn: Connection
    ) -> list[dict[str, Any]]:
        if not sample_ids:
            return []
        rows = (
            conn.execute(
                select(derivatives)
                .where(derivatives.c.sample_id.in_(list(sample_ids)))
                .order_by(
                    derivatives.c.sample_id,
                    derivatives.c.name,
                    derivatives.c.id,
                )
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]

    def insert_run(self, row: dict[str, object], *, conn: Connection) -> int:
        return int(
            conn.execute(
                insert(workflow_runs).values(**row).returning(workflow_runs.c.id)
            ).scalar_one()
        )

    def insert_run_node(self, row: dict[str, object], *, conn: Connection) -> int:
        return int(
            conn.execute(
                insert(workflow_run_nodes)
                .values(**row)
                .returning(workflow_run_nodes.c.id)
            ).scalar_one()
        )

    def insert_job(self, row: dict[str, object], *, conn: Connection) -> int:
        return int(
            conn.execute(
                insert(execution_jobs).values(**row).returning(execution_jobs.c.id)
            ).scalar_one()
        )

    def insert_dependencies(
        self, rows: list[dict[str, int]], *, conn: Connection
    ) -> None:
        if rows:
            conn.execute(insert(execution_job_dependencies), rows)

    def release_ready_jobs(self, run_id: int, *, conn: Connection) -> None:
        blocked_ids = (
            conn.execute(
                select(execution_jobs.c.id).where(
                    execution_jobs.c.workflow_run_id == run_id,
                    execution_jobs.c.status == "blocked",
                )
            )
            .scalars()
            .all()
        )
        for job_id in blocked_ids:
            incomplete = conn.execute(
                select(execution_job_dependencies.c.depends_on_execution_job_id)
                .join(
                    execution_jobs,
                    execution_jobs.c.id
                    == execution_job_dependencies.c.depends_on_execution_job_id,
                )
                .where(
                    execution_job_dependencies.c.execution_job_id == job_id,
                    execution_jobs.c.status != "completed",
                )
                .limit(1)
            ).scalar_one_or_none()
            if incomplete is None:
                conn.execute(
                    update(execution_jobs)
                    .where(execution_jobs.c.id == job_id)
                    .values(status="pending")
                )
