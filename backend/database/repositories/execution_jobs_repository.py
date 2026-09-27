from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import case, func, select, update
from sqlalchemy.engine import Engine

from ..tables.execution_job_dependencies_table import execution_job_dependencies
from ..tables.execution_jobs_table import execution_jobs
from ..tables.step_outputs_table import step_outputs
from ..tables.raw_outputs_table import raw_outputs
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_run_nodes_table import workflow_run_nodes
from ..tables.workflow_runs_table import workflow_runs
from ..tables.workflow_steps_table import workflow_steps


class ExecutionJobsRepository:
    """Persist and schedule the independent jobs of a resolved workflow graph."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    @staticmethod
    def _display_row(row: dict[str, Any]) -> dict[str, Any]:
        refs = list(row.get("input_refs") or [])
        output_refs = list(row.get("output_refs") or [])
        row["entity_ids"] = [str(item.get("entity_id")) for item in refs]
        row["output_entity_ids"] = [
            str(item.get("entity_id")) for item in output_refs
        ]
        row["target_label"] = ", ".join(row["entity_ids"]) or row.get("skip_reason") or f"Job {row['id']}"
        row["workflow_dag_node_id"] = row.get("current_workflow_dag_node_id")
        return row

    def list_for_workflow(
        self, workflow_id: int, workflow_dag_node_id: int | None = None
    ) -> list[dict[str, Any]]:
        statement = (
            select(
                execution_jobs,
                workflow_steps.c.name.label("next_step_name"),
                workflow_run_nodes.c.topological_depth,
            )
            .outerjoin(workflow_steps, workflow_steps.c.id == execution_jobs.c.workflow_step_id)
            .outerjoin(workflow_run_nodes, workflow_run_nodes.c.id == execution_jobs.c.workflow_run_node_id)
            .where(execution_jobs.c.workflow_id == workflow_id)
        )
        if workflow_dag_node_id is not None:
            statement = statement.where(execution_jobs.c.current_workflow_dag_node_id == workflow_dag_node_id)
        with self.engine.connect() as connection:
            has_run = connection.execute(
                select(workflow_runs.c.id).where(workflow_runs.c.workflow_id == workflow_id)
            ).scalar_one_or_none()
            if has_run is not None:
                statement = statement.where(execution_jobs.c.workflow_run_id == has_run)
            rows = connection.execute(statement.order_by(execution_jobs.c.id)).mappings().all()
        return [self._display_row(dict(row)) for row in rows]

    def execution_graph(self, workflow_id: int) -> dict[str, Any]:
        with self.engine.connect() as connection:
            run = connection.execute(
                select(workflow_runs).where(workflow_runs.c.workflow_id == workflow_id)
            ).mappings().first()
            if run is None:
                return {"run": None, "nodes": [], "edges": []}
            statuses = ("blocked", "pending", "queued", "running", "completed")
            counts = [
                func.sum(case((execution_jobs.c.status == status, 1), else_=0)).label(status)
                for status in statuses
            ]
            node_rows = connection.execute(
                select(
                    workflow_run_nodes.c.id.label("workflow_run_node_id"),
                    workflow_run_nodes.c.workflow_dag_node_id,
                    workflow_run_nodes.c.topological_depth,
                    workflow_run_nodes.c.released,
                    workflow_dag_nodes.c.row,
                    workflow_dag_nodes.c.col,
                    workflow_steps.c.execution_scope,
                    workflow_steps.c.output_scope,
                    workflow_dag_nodes.c.workflow_step_id,
                    workflow_steps.c.name.label("step_name"),
                    *counts,
                    func.count(execution_jobs.c.id).label("total"),
                )
                .join(workflow_dag_nodes, workflow_dag_nodes.c.id == workflow_run_nodes.c.workflow_dag_node_id)
                .join(workflow_steps, workflow_steps.c.id == workflow_dag_nodes.c.workflow_step_id)
                .outerjoin(execution_jobs, execution_jobs.c.workflow_run_node_id == workflow_run_nodes.c.id)
                .where(workflow_run_nodes.c.workflow_run_id == run["id"])
                .group_by(
                    workflow_run_nodes.c.id,
                    workflow_run_nodes.c.workflow_dag_node_id,
                    workflow_run_nodes.c.topological_depth,
                    workflow_run_nodes.c.released,
                    workflow_dag_nodes.c.row,
                    workflow_dag_nodes.c.col,
                    workflow_steps.c.execution_scope,
                    workflow_steps.c.output_scope,
                    workflow_dag_nodes.c.workflow_step_id,
                    workflow_steps.c.name,
                )
                .order_by(workflow_run_nodes.c.topological_depth, workflow_dag_nodes.c.col, workflow_dag_nodes.c.row)
            ).mappings().all()
            edge_rows = connection.execute(
                select(workflow_dag_edges).where(workflow_dag_edges.c.workflow_id == workflow_id)
            ).mappings().all()
        nodes = []
        for row in node_rows:
            item = dict(row)
            for name in (*statuses, "total"):
                item[name] = int(item.get(name) or 0)
            nodes.append(item)
        return {"run": dict(run), "nodes": nodes, "edges": [dict(row) for row in edge_rows]}

    def fetch_for_workflow(self, workflow_id: int, execution_job_id: int) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(execution_jobs).where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id == execution_job_id,
                )
            ).mappings().first()
        return self._display_row(dict(row)) if row else None

    def create_jobs(self, *, workflow_id: int, sample_ids: Sequence[str] | None = None) -> None:
        from backend.services.execution_graph_resolver import ExecutionGraphResolver
        ExecutionGraphResolver(self.engine).resolve(workflow_id)

    def recover_interrupted_jobs(self) -> int:
        with self.engine.begin() as connection:
            result = connection.execute(
                update(execution_jobs)
                .where(execution_jobs.c.status == "running")
                .values(status="pending", error_message="Execution was interrupted by a backend restart.")
            )
            connection.execute(update(workflow_runs).where(workflow_runs.c.status == "running").values(status="stopped"))
        return int(result.rowcount or 0)

    def set_run_status(self, workflow_id: int, status: str) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(workflow_runs)
                .where(workflow_runs.c.workflow_id == workflow_id)
                .values(status=status, updated_at=func.current_timestamp())
            )

    def queue(self, workflow_id: int, execution_job_ids: Sequence[int]) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as connection:
            result = connection.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status == "pending",
                )
                .values(status="queued", error_message=None, updated_at=func.current_timestamp())
            )
        return int(result.rowcount or 0)

    def queue_node(self, workflow_id: int, workflow_dag_node_id: int) -> int:
        with self.engine.begin() as connection:
            released = connection.execute(
                select(workflow_run_nodes.c.released)
                .join(workflow_runs, workflow_runs.c.id == workflow_run_nodes.c.workflow_run_id)
                .where(
                    workflow_runs.c.workflow_id == workflow_id,
                    workflow_run_nodes.c.workflow_dag_node_id == workflow_dag_node_id,
                )
            ).scalar_one_or_none()
            if released is not True:
                return 0
            result = connection.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.current_workflow_dag_node_id == workflow_dag_node_id,
                    execution_jobs.c.status == "pending",
                )
                .values(status="queued", error_message=None, updated_at=func.current_timestamp())
            )
        return int(result.rowcount or 0)

    def set_node_released(self, workflow_id: int, workflow_dag_node_id: int, released: bool) -> int:
        with self.engine.begin() as connection:
            result = connection.execute(
                update(workflow_run_nodes)
                .where(
                    workflow_run_nodes.c.workflow_dag_node_id == workflow_dag_node_id,
                    workflow_run_nodes.c.workflow_run_id.in_(
                        select(workflow_runs.c.id).where(workflow_runs.c.workflow_id == workflow_id)
                    ),
                )
                .values(released=released, updated_at=func.current_timestamp())
            )
            if released:
                run_status = connection.execute(
                    select(workflow_runs.c.status).where(workflow_runs.c.workflow_id == workflow_id)
                ).scalar_one_or_none()
                if run_status == "running":
                    connection.execute(
                        update(execution_jobs)
                        .where(
                            execution_jobs.c.workflow_id == workflow_id,
                            execution_jobs.c.current_workflow_dag_node_id == workflow_dag_node_id,
                            execution_jobs.c.status == "pending",
                        )
                        .values(status="queued")
                    )
        return int(result.rowcount or 0)

    def dequeue(self, workflow_id: int, execution_job_ids: Sequence[int]) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as connection:
            result = connection.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status == "queued",
                )
                .values(status="pending", updated_at=func.current_timestamp())
            )
        return int(result.rowcount or 0)

    def retry_completed(self, workflow_id: int, execution_job_ids: Sequence[int]) -> int:
        if not execution_job_ids:
            return 0
        with self.engine.begin() as connection:
            result = connection.execute(
                update(execution_jobs)
                .where(
                    execution_jobs.c.workflow_id == workflow_id,
                    execution_jobs.c.id.in_(list(execution_job_ids)),
                    execution_jobs.c.status == "completed",
                    execution_jobs.c.skip_reason.is_(None),
                )
                .values(status="queued", error_message=None, updated_at=func.current_timestamp())
            )
        return int(result.rowcount or 0)

    def claim_next_job(self, excluded_workflow_ids: Sequence[int] | None = None) -> dict[str, Any] | None:
        conditions = [execution_jobs.c.status == "queued", workflow_runs.c.status == "running"]
        if excluded_workflow_ids:
            conditions.append(execution_jobs.c.workflow_id.not_in(list(excluded_workflow_ids)))
        with self.engine.begin() as connection:
            candidate = connection.execute(
                select(execution_jobs.c.id)
                .join(workflow_runs, workflow_runs.c.id == execution_jobs.c.workflow_run_id)
                .join(workflow_run_nodes, workflow_run_nodes.c.id == execution_jobs.c.workflow_run_node_id)
                .where(*conditions, workflow_run_nodes.c.released.is_(True))
                .order_by(
                    case(
                        (
                            workflow_runs.c.execution_mode == "continuous",
                            -workflow_run_nodes.c.topological_depth,
                        ),
                        else_=workflow_run_nodes.c.topological_depth,
                    ),
                    execution_jobs.c.id,
                )
                .limit(1)
            ).scalar_one_or_none()
            if candidate is None:
                return None
            result = connection.execute(
                update(execution_jobs)
                .where(execution_jobs.c.id == candidate, execution_jobs.c.status == "queued")
                .values(status="running", updated_at=func.current_timestamp())
            )
            if result.rowcount != 1:
                return None
            row = connection.execute(select(execution_jobs).where(execution_jobs.c.id == candidate)).mappings().one()
        item = dict(row)
        item["workflow_dag_node_id"] = item["current_workflow_dag_node_id"]
        return item

    def complete_job_and_advance(self, job: dict[str, Any]) -> str:
        with self.engine.begin() as connection:
            connection.execute(
                update(execution_jobs).where(execution_jobs.c.id == job["id"])
                .values(status="completed", error_message=None, updated_at=func.current_timestamp())
            )
            run = connection.execute(
                select(workflow_runs).where(workflow_runs.c.id == job.get("workflow_run_id"))
            ).mappings().first()
            if run is not None:
                self._advance_ready(connection, dict(run))
                remaining = connection.execute(
                    select(execution_jobs.c.id).where(
                        execution_jobs.c.workflow_run_id == run["id"],
                        execution_jobs.c.status != "completed",
                    ).limit(1)
                ).scalar_one_or_none()
                if remaining is None:
                    connection.execute(update(workflow_runs).where(workflow_runs.c.id == run["id"]).values(status="completed"))
        return "completed"

    def _advance_ready(self, connection, run: dict[str, Any]) -> None:
        candidates = connection.execute(
            select(execution_jobs.c.id, workflow_run_nodes.c.topological_depth, workflow_run_nodes.c.released)
            .join(workflow_run_nodes, workflow_run_nodes.c.id == execution_jobs.c.workflow_run_node_id)
            .where(execution_jobs.c.workflow_run_id == run["id"], execution_jobs.c.status == "blocked")
        ).mappings().all()
        for candidate in candidates:
            incomplete_parent = connection.execute(
                select(execution_job_dependencies.c.depends_on_execution_job_id)
                .join(execution_jobs, execution_jobs.c.id == execution_job_dependencies.c.depends_on_execution_job_id)
                .where(
                    execution_job_dependencies.c.execution_job_id == candidate["id"],
                    execution_jobs.c.status != "completed",
                ).limit(1)
            ).scalar_one_or_none()
            if incomplete_parent is not None:
                continue
            if run["execution_mode"] == "stage_by_stage":
                earlier_incomplete = connection.execute(
                    select(execution_jobs.c.id)
                    .join(workflow_run_nodes, workflow_run_nodes.c.id == execution_jobs.c.workflow_run_node_id)
                    .where(
                        execution_jobs.c.workflow_run_id == run["id"],
                        workflow_run_nodes.c.topological_depth < candidate["topological_depth"],
                        execution_jobs.c.status != "completed",
                    ).limit(1)
                ).scalar_one_or_none()
                if earlier_incomplete is not None:
                    continue
            status = "queued" if run["status"] == "running" and candidate["released"] else "pending"
            connection.execute(update(execution_jobs).where(execution_jobs.c.id == candidate["id"]).values(status=status))

    def set_job_failed(self, execution_job_id: int, error_message: str) -> None:
        with self.engine.begin() as connection:
            run_id = connection.execute(
                select(execution_jobs.c.workflow_run_id).where(execution_jobs.c.id == execution_job_id)
            ).scalar_one_or_none()
            connection.execute(
                update(execution_jobs).where(execution_jobs.c.id == execution_job_id)
                .values(status="pending", error_message=error_message, updated_at=func.current_timestamp())
            )
            if run_id is not None:
                connection.execute(update(workflow_runs).where(workflow_runs.c.id == run_id).values(status="stopped"))

    def acknowledge_failure(self, workflow_id: int, execution_job_id: int, action: str) -> None:
        if action not in {"retry", "skip", "abort"}:
            raise ValueError(f"Unsupported failure acknowledgement action: {action}")
        with self.engine.begin() as connection:
            if action == "retry":
                connection.execute(
                    update(execution_jobs)
                    .where(execution_jobs.c.workflow_id == workflow_id, execution_jobs.c.id == execution_job_id)
                    .values(status="queued", error_message=None)
                )
                connection.execute(update(workflow_runs).where(workflow_runs.c.workflow_id == workflow_id).values(status="running"))
            elif action == "skip":
                connection.execute(
                    update(execution_jobs)
                    .where(execution_jobs.c.workflow_id == workflow_id, execution_jobs.c.id == execution_job_id)
                    .values(status="pending", error_message=None)
                )
                connection.execute(update(workflow_runs).where(workflow_runs.c.workflow_id == workflow_id).values(status="running"))
            else:
                connection.execute(update(workflow_runs).where(workflow_runs.c.workflow_id == workflow_id).values(status="stopped"))

    def fetch_detail(self, workflow_id: int, execution_job_id: int) -> dict[str, Any] | None:
        job = self.fetch_for_workflow(workflow_id, execution_job_id)
        if job is None:
            return None
        with self.engine.connect() as connection:
            parent_jobs = connection.execute(
                select(
                    execution_jobs.c.id,
                    execution_jobs.c.workflow_step_id,
                )
                .join(
                    execution_job_dependencies,
                    execution_job_dependencies.c.depends_on_execution_job_id
                    == execution_jobs.c.id,
                )
                .where(
                    execution_job_dependencies.c.execution_job_id
                    == execution_job_id
                )
                .order_by(execution_jobs.c.id)
            ).mappings().all()
            related_job_ids = [execution_job_id, *(int(row["id"]) for row in parent_jobs)]
            outputs = connection.execute(
                select(step_outputs)
                .where(step_outputs.c.execution_job_id.in_(related_job_ids))
                .order_by(step_outputs.c.id)
            ).mappings().all()
            attempts = connection.execute(
                select(raw_outputs)
                .where(raw_outputs.c.execution_job_id == execution_job_id)
                .order_by(raw_outputs.c.attempt_no, raw_outputs.c.id)
            ).mappings().all()
            steps = connection.execute(
                select(workflow_steps)
                .join(workflow_dag_nodes, workflow_dag_nodes.c.workflow_step_id == workflow_steps.c.id)
                .where(workflow_dag_nodes.c.workflow_id == workflow_id)
            ).mappings().all()
            step_rows = [dict(row) for row in steps]
            dependencies = [
                {
                    "workflow_step_id": int(job["workflow_step_id"]),
                    "source_workflow_step_id": int(row["workflow_step_id"]),
                }
                for row in parent_jobs
                if job.get("workflow_step_id") is not None
                and row.get("workflow_step_id") is not None
            ]
        return {
            **job,
            "step_outputs": [dict(row) for row in outputs],
            "raw_outputs": [dict(row) for row in attempts],
            "workflow_steps": step_rows,
            "step_output_dependencies": dependencies,
        }
