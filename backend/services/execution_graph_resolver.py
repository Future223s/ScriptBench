from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

from sqlalchemy.engine import Engine

from backend.database.repositories.execution_graph_repository import (
    ExecutionGraphRepository,
)


@dataclass(frozen=True)
class ExecutionUnit:
    key: str
    refs: list[dict[str, str]]
    lineage: frozenset[str]
    sample_id: str | None = None
    skip_reason: str | None = None


class ExecutionGraphResolver:
    """Resolve an immutable workflow DAG into independently schedulable jobs."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self.repository = ExecutionGraphRepository(engine)

    def resolve(self, workflow_id: int) -> int:
        with self.repository.transaction() as connection:
            existing = self.repository.fetch_run_id(workflow_id, conn=connection)
            if existing is not None:
                return existing

            workflow = self.repository.fetch_workflow(workflow_id, conn=connection)
            nodes = self.repository.list_nodes(workflow_id, conn=connection)
            edges = self.repository.list_edges(workflow_id, conn=connection)
            if not nodes:
                raise LookupError(f"Workflow {workflow_id} has no executable DAG node")

            depths, parents = self._topology(nodes, edges)
            sample_rows = self.repository.list_samples(
                int(workflow["sample_set_id"]), conn=connection
            )
            sample_ids = [str(row["id"]) for row in sample_rows]
            derivative_rows = self.repository.list_derivatives(
                sample_ids, conn=connection
            )

            run_id = self.repository.insert_run(
                {
                    "workflow_id": workflow_id,
                    "execution_mode": workflow["execution_mode"],
                    "status": "stopped",
                },
                conn=connection,
            )

            jobs_by_node: dict[int, list[tuple[int, ExecutionUnit]]] = {}
            for node in sorted(nodes, key=lambda row: (depths[int(row["id"])], int(row["id"]))):
                node_id = int(node["id"])
                run_node_id = self.repository.insert_run_node(
                    {
                        "workflow_run_id": run_id,
                        "workflow_dag_node_id": node_id,
                        "topological_depth": depths[node_id],
                        "released": True,
                    },
                    conn=connection,
                )
                units = self._units(str(node["execution_scope"]), sample_rows, derivative_rows)
                if not units:
                    units = [ExecutionUnit(
                        key="zero-cardinality",
                        refs=[],
                        lineage=frozenset({"*"}),
                        skip_reason="zero-cardinality",
                    )]
                node_jobs: list[tuple[int, ExecutionUnit]] = []
                for unit in units:
                    output_refs = self._output_refs(
                        str(node["output_scope"]), unit.lineage
                    )
                    is_zero = unit.skip_reason == "zero-cardinality" or not output_refs
                    skip_reason = unit.skip_reason or (
                        "zero-output-cardinality" if not output_refs else None
                    )
                    job_id = self.repository.insert_job(
                        {
                            "workflow_id": workflow_id,
                            "workflow_run_id": run_id,
                            "workflow_run_node_id": run_node_id,
                            "workflow_step_id": int(node["workflow_step_id"]),
                            "sample_id": unit.sample_id,
                            "current_workflow_dag_node_id": node_id,
                            "execution_scope": node["execution_scope"],
                            "output_scope": node["output_scope"],
                            "input_key": unit.key,
                            "input_refs": unit.refs,
                            "output_refs": output_refs,
                            "status": "completed"
                            if is_zero
                            else ("pending" if not parents[node_id] else "blocked"),
                            "skip_reason": skip_reason,
                        },
                        conn=connection,
                    )
                    node_jobs.append((job_id, unit))
                jobs_by_node[node_id] = node_jobs

            for child_id, parent_ids in parents.items():
                for child_job_id, child_unit in jobs_by_node[child_id]:
                    for parent_id in parent_ids:
                        parent_jobs = jobs_by_node[parent_id]
                        related = [
                            parent_job_id
                            for parent_job_id, parent_unit in parent_jobs
                            if "*" in parent_unit.lineage
                            or "*" in child_unit.lineage
                            or bool(parent_unit.lineage & child_unit.lineage)
                        ]
                        if not related:
                            raise ValueError(
                                f"Node {child_id} job {child_unit.key} has no related job in parent node {parent_id}"
                            )
                        self.repository.insert_dependencies(
                            [
                                {
                                    "execution_job_id": child_job_id,
                                    "depends_on_execution_job_id": dependency_id,
                                }
                                for dependency_id in related
                            ],
                            conn=connection,
                        )

            # A zero-cardinality parent is already complete, so its children can
            # become pending immediately when every other parent is also complete.
            self.repository.release_ready_jobs(run_id, conn=connection)
            return run_id

    @staticmethod
    def _topology(
        nodes: list[dict[str, Any]], edges: list[dict[str, Any]]
    ) -> tuple[dict[int, int], dict[int, set[int]]]:
        node_ids = {int(node["id"]) for node in nodes}
        parents = {node_id: set() for node_id in node_ids}
        children = {node_id: set() for node_id in node_ids}
        for edge in edges:
            source = int(edge["from_workflow_dag_node_id"])
            target = int(edge["to_workflow_dag_node_id"])
            if source not in node_ids or target not in node_ids:
                raise ValueError("Workflow edge references a node outside the workflow")
            parents[target].add(source)
            children[source].add(target)
        remaining = {node_id: len(values) for node_id, values in parents.items()}
        queue = deque(sorted(node_id for node_id, count in remaining.items() if count == 0))
        depths = {node_id: 0 for node_id in queue}
        visited: list[int] = []
        while queue:
            node_id = queue.popleft()
            visited.append(node_id)
            for child_id in sorted(children[node_id]):
                depths[child_id] = max(depths.get(child_id, 0), depths[node_id] + 1)
                remaining[child_id] -= 1
                if remaining[child_id] == 0:
                    queue.append(child_id)
        if len(visited) != len(node_ids):
            raise ValueError("Workflow DAG contains a cycle")
        return depths, parents

    @staticmethod
    def _units(
        scope: str,
        sample_rows: list[dict[str, Any]],
        derivative_rows: list[dict[str, Any]],
    ) -> list[ExecutionUnit]:
        samples_by_document: dict[str, list[dict[str, Any]]] = defaultdict(list)
        derivatives_by_sample: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in sample_rows:
            if row.get("document_id") is not None:
                samples_by_document[str(row["document_id"])].append(row)
        for row in derivative_rows:
            if row.get("sample_id") is not None:
                derivatives_by_sample[str(row["sample_id"])].append(row)

        def lineage_for_samples(rows: list[dict[str, Any]]) -> frozenset[str]:
            values: set[str] = set()
            for sample in rows:
                sample_id = str(sample["id"])
                values.add(f"sample:{sample_id}")
                if sample.get("document_id") is not None:
                    values.add(f"document:{sample['document_id']}")
                values.update(
                    f"derivative:{row['id']}" for row in derivatives_by_sample[sample_id]
                )
            return frozenset(values)

        if scope in {"documents", "documents_batch"}:
            document_ids = list(samples_by_document)
            groups = [document_ids] if scope == "documents_batch" and document_ids else [[value] for value in document_ids]
            return [
                ExecutionUnit(
                    key="|".join(group),
                    refs=[{"entity_type": "document", "entity_id": value} for value in group],
                    lineage=lineage_for_samples([sample for value in group for sample in samples_by_document[value]]),
                )
                for group in groups
            ]

        if scope in {"samples", "samples_batch"}:
            if scope == "samples":
                groups = [[row] for row in sample_rows]
            else:
                grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
                for row in sample_rows:
                    group_key = (
                        f"document:{row['document_id']}"
                        if row.get("document_id") is not None
                        else f"sample:{row['id']}"
                    )
                    grouped[group_key].append(row)
                groups = list(grouped.values())
            return [
                ExecutionUnit(
                    key="|".join(str(row["id"]) for row in group),
                    refs=[{"entity_type": "sample", "entity_id": str(row["id"])} for row in group],
                    lineage=lineage_for_samples(group),
                    sample_id=str(group[0]["id"]) if len(group) == 1 else None,
                )
                for group in groups
            ]

        if scope in {"derivatives", "derivatives_batch"}:
            if scope == "derivatives":
                groups = [[row] for row in derivative_rows]
            else:
                groups = list(derivatives_by_sample.values())
            sample_by_id = {str(row["id"]): row for row in sample_rows}
            units: list[ExecutionUnit] = []
            for group in groups:
                sample_id = str(group[0]["sample_id"])
                sample = sample_by_id[sample_id]
                lineage = set(lineage_for_samples([sample]))
                units.append(ExecutionUnit(
                    key="|".join(str(row["id"]) for row in group),
                    refs=[{"entity_type": "derivative", "entity_id": str(row["id"])} for row in group],
                    lineage=frozenset(lineage),
                    sample_id=sample_id,
                ))
            return units
        raise ValueError(f"Unsupported execution scope: {scope}")

    @staticmethod
    def _output_refs(
        scope: str, lineage: frozenset[str]
    ) -> list[dict[str, str]]:
        base_scope = scope.removesuffix("_batch")
        entity_type = {
            "documents": "document",
            "samples": "sample",
            "derivatives": "derivative",
        }.get(base_scope)
        if entity_type is None:
            raise ValueError(f"Unsupported output scope: {scope}")
        prefix = f"{entity_type}:"
        entity_ids = sorted(
            value[len(prefix):] for value in lineage if value.startswith(prefix)
        )
        return [
            {"entity_type": entity_type, "entity_id": entity_id}
            for entity_id in entity_ids
        ]
