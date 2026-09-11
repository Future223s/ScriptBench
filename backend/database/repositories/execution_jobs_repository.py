from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, insert, select, update
from sqlalchemy.engine import Engine

from ..tables.execution_jobs_table import execution_jobs
from ..tables.step_outputs_table import step_outputs
from ..tables.samples_table import samples
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_steps_table import workflow_steps


class ExecutionJobsRepository:
    """The single persisted execution record for a workflow/sample pair."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_for_workflow(self, workflow_id: int) -> list[dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    select(
                        execution_jobs,
                        workflow_steps.c.name.label("next_step_name"),
                    )
                    .outerjoin(
                        workflow_dag_nodes,
                        workflow_dag_nodes.c.id
                        == execution_jobs.c.current_workflow_dag_node_id,
                    )
                    .outerjoin(
                        workflow_steps,
                        workflow_steps.c.id
                        == workflow_dag_nodes.c.workflow_step_id,
                    )
                    .where(execution_jobs.c.workflow_id == workflow_id)
                    .order_by(execution_jobs.c.id)
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def fetch_for_workflow(
        self, workflow_id: int, execution_job_id: int
    ) -> dict[str, Any] | None:
        with self.engine.connect() as conn:
            row = (
                conn.execute(
                    select(execution_jobs).where(
                        execution_jobs.c.workflow_id == workflow_id,
                        execution_jobs.c.id == execution_job_id,
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def create_jobs(self, *, workflow_id: int, sample_ids: Sequence[str]) -> None:
        if not sample_ids:
            return
        with self.engine.begin() as conn:
            initial_node_id = conn.execute(
                select(workflow_dag_nodes.c.id)
                .where(workflow_dag_nodes.c.workflow_id == workflow_id)
                .order_by(
                    workflow_dag_nodes.c.row.asc(),
                    workflow_dag_nodes.c.col.asc(),
                    workflow_dag_nodes.c.id.asc(),
                )
                .limit(1)
            ).scalar_one_or_none()
            if initial_node_id is None:
                raise LookupError(f"Workflow {workflow_id} has no executable DAG node")
            for sample_id in sample_ids:
                exists = conn.execute(
                    select(execution_jobs.c.id).where(
                        execution_jobs.c.workflow_id == workflow_id,
                        execution_jobs.c.sample_id == sample_id,
                    )
                ).scalar_one_or_none()
                if exists is None:
                    conn.execute(
                        insert(execution_jobs).values(
                            workflow_id=workflow_id,
                            sample_id=sample_id,
                            current_workflow_dag_node_id=initial_node_id,
                        )
                    )

    def recover_interrupted_jobs(self) -> int:
        """Make jobs left running by a stopped process actionable again."""
        with self.engine.begin() as conn:
            result = conn.execute(
                update(execution_jobs)
                .where(execution_jobs.c.status == "running")
                .values(
                    status="pending",
                    error_message="Execution was interrupted by a backend restart.",
                )
            )
        return int(result.rowcount or 0)

    def queue(self, workflow_id: int, execution_job_ids: Sequence[int]) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status.in_(["pending", "failed"]),
                )
                .values(status="queued", error_message=None)
            )
        return int(result.rowcount or 0)

    def dequeue(self, workflow_id: int, execution_job_ids: Sequence[int]) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status == "queued",
                )
                .values(status="pending")
            )
        return int(result.rowcount or 0)

    def retry_completed(
        self, workflow_id: int, execution_job_ids: Sequence[int]
    ) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status == "completed",
                )
                .values(status="queued", error_message=None)
            )
        return int(result.rowcount or 0)

    def claim_next_job(
        self, excluded_workflow_ids: Sequence[int] | None = None
    ) -> dict[str, Any] | None:
        conditions = [execution_jobs.c.status == "queued"]
        if excluded_workflow_ids:
            conditions.append(
                execution_jobs.c.workflow_id.not_in(list(excluded_workflow_ids))
            )
        with self.engine.begin() as conn:
            candidate = conn.execute(
                select(execution_jobs.c.id)
                .where(*conditions)
                .order_by(execution_jobs.c.id)
                .limit(1)
            ).scalar_one_or_none()
            if candidate is None:
                return None
            job = (
                conn.execute(
                    select(execution_jobs).where(
                        execution_jobs.c.id == candidate
                    )
                )
                .mappings()
                .one()
            )
            node_id = (
                job["current_workflow_dag_node_id"]
                or conn.execute(
                    select(workflow_dag_nodes.c.id)
                    .where(workflow_dag_nodes.c.workflow_id == job["workflow_id"])
                    .order_by(
                        workflow_dag_nodes.c.row,
                        workflow_dag_nodes.c.col,
                        workflow_dag_nodes.c.id,
                    )
                    .limit(1)
                ).scalar_one_or_none()
            )
            if node_id is None:
                raise LookupError(
                    f"Workflow {job['workflow_id']} has no executable DAG node"
                )
            result = conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.id == candidate,
                    execution_jobs.c.status == "queued",
                )
                .values(status="running", current_workflow_dag_node_id=node_id)
            )
            if result.rowcount != 1:
                return None
            claimed = (
                conn.execute(
                    select(execution_jobs).where(
                        execution_jobs.c.id == candidate
                    )
                )
                .mappings()
                .one()
            )
        return self._with_step(dict(claimed))

    def _with_step(self, job: dict[str, Any]) -> dict[str, Any]:
        node_id = job.get("current_workflow_dag_node_id")
        if node_id is None:
            return job
        with self.engine.connect() as conn:
            step_id = conn.execute(
                select(workflow_dag_nodes.c.workflow_step_id).where(
                    workflow_dag_nodes.c.id == node_id
                )
            ).scalar_one()
        return {**job, "workflow_dag_node_id": node_id, "workflow_step_id": step_id}

    def complete_job_and_advance(self, job: dict[str, Any]) -> str:
        node_id = int(job["workflow_dag_node_id"])
        with self.engine.begin() as conn:
            next_node = conn.execute(
                select(workflow_dag_edges.c.to_workflow_dag_node_id)
                .where(
                    workflow_dag_edges.c.workflow_id == job["workflow_id"],
                    workflow_dag_edges.c.from_workflow_dag_node_id == node_id,
                )
                .order_by(workflow_dag_edges.c.id)
                .limit(1)
            ).scalar_one_or_none()
            values = (
                {"status": "completed"}
                if next_node is None
                else {"status": "queued", "current_workflow_dag_node_id": next_node}
            )
            conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.id == job["id"],
                )
                .values(**values)
            )
        return values["status"]

    def set_job_failed(self, execution_job_id: int, error_message: str) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                update(execution_jobs)
                .where(execution_jobs.c.id == execution_job_id)
                .values(status="pending", error_message=error_message)
            )

    def acknowledge_failure(
        self, workflow_id: int, execution_job_id: int, action: str
    ) -> None:
        statuses = {"retry": "queued", "stop_execution": "pending"}
        if action not in statuses:
            raise ValueError(f"Unsupported failure acknowledgement action: {action}")
        values: dict[str, Any] = {"status": statuses[action]}
        if action == "retry":
            values["error_message"] = None
        with self.engine.begin() as conn:
            conn.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id == execution_job_id,
                    execution_jobs.c.status == "pending",
                )
                .values(**values)
            )

    def fetch_detail(
        self, workflow_id: int, execution_job_id: int
    ) -> dict[str, Any] | None:
        job = self.fetch_for_workflow(workflow_id, execution_job_id)
        if job is None:
            return None
        with self.engine.connect() as conn:
            outputs = (
                conn.execute(
                    select(step_outputs)
                    .where(step_outputs.c.execution_job_id == execution_job_id)
                    .order_by(step_outputs.c.id)
                )
                .mappings()
                .all()
            )
            steps = (
                conn.execute(
                    select(workflow_steps)
                    .join(
                        workflow_dag_nodes,
                        workflow_dag_nodes.c.workflow_step_id
                        == workflow_steps.c.id,
                    )
                    .where(workflow_dag_nodes.c.workflow_id == workflow_id)
                )
                .mappings()
                .all()
            )
        return {
            **job,
            "step_outputs": [dict(row) for row in outputs],
            "workflow_steps": [dict(row) for row in steps],
        }
