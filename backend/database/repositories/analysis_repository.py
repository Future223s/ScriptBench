from __future__ import annotations

from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.engine import Engine

from backend.services.disagreements import (
    average_disagreement_count,
    build_disagreements,
    classify_correctness,
    find_disagreement_regions,
)
from ..tables.execution_jobs_table import execution_jobs
from ..tables.samples_table import samples
from ..tables.sample_set_samples_table import sample_set_samples
from ..tables.sample_sets_table import sample_sets
from ..tables.step_outputs_table import step_outputs
from ..tables.raw_outputs_table import raw_outputs
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_steps_table import workflow_steps
from ..tables.workflows_table import workflows


class AnalysisRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def _row_statement(self):
        return (
            select(
                step_outputs.c.id,
                step_outputs.c.workflow_id,
                step_outputs.c.workflow_step_id,
                step_outputs.c.sample_id,
                raw_outputs.c.attempt_no,
                raw_outputs.c.raw_model_response,
                step_outputs.c.output.label("parsed_output"),
                raw_outputs.c.parse_status,
                raw_outputs.c.parse_error,
                step_outputs.c.cer,
                raw_outputs.c.time_elapsed,
                raw_outputs.c.started_at,
                raw_outputs.c.completed_at,
                workflow_steps.c.name.label("workflow_step_name"),
                workflow_steps.c.executor_config.label(
                    "workflow_step_executor_config"
                ),
                workflows.c.name.label("workflow_name"),
                workflows.c.sample_set_id,
                sample_sets.c.name.label("sample_set_name"),
                samples.c.name.label("sample_name"),
                samples.c.mime_type.label("sample_mime_type"),
                samples.c.ground_truth_text,
            )
            .join(workflows, workflows.c.id == step_outputs.c.workflow_id)
            .join(raw_outputs, raw_outputs.c.id == step_outputs.c.raw_output_id)
            .join(
                workflow_steps,
                workflow_steps.c.id == step_outputs.c.workflow_step_id,
            )
            .join(samples, samples.c.id == step_outputs.c.sample_id)
            .join(sample_sets, sample_sets.c.id == workflows.c.sample_set_id)
        )

    def _rows(
        self,
        sample_set_id: int | None = None,
        *,
        after_output_id: int | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        statement = self._row_statement()
        if sample_set_id is not None:
            statement = statement.where(workflows.c.sample_set_id == sample_set_id)
        if after_output_id is not None:
            statement = statement.where(step_outputs.c.id > after_output_id)
        statement = statement.order_by(step_outputs.c.id)
        if limit is not None:
            statement = statement.limit(limit)
        with self.engine.connect() as conn:
            rows = conn.execute(statement).mappings().all()
        return [dict(row) for row in rows]

    def _rows_for_keys(
        self,
        keys: set[tuple[int, str, int]],
    ) -> list[dict[str, Any]]:
        if not keys:
            return []
        keys_by_workflow: dict[int, dict[str, set[Any]]] = {}
        for workflow_id, sample_id, workflow_step_id in keys:
            group = keys_by_workflow.setdefault(
                workflow_id,
                {"sample_ids": set(), "workflow_step_ids": set()},
            )
            group["sample_ids"].add(sample_id)
            group["workflow_step_ids"].add(workflow_step_id)
        conditions = [
            and_(
                step_outputs.c.workflow_id == workflow_id,
                step_outputs.c.sample_id.in_(group["sample_ids"]),
                step_outputs.c.workflow_step_id.in_(group["workflow_step_ids"]),
            )
            for workflow_id, group in keys_by_workflow.items()
        ]
        with self.engine.connect() as conn:
            rows = (
                conn.execute(
                    self._row_statement()
                    .where(or_(*conditions))
                    .order_by(step_outputs.c.id)
                )
                .mappings()
                .all()
            )
        return [
            dict(row)
            for row in rows
            if (
                int(row["workflow_id"]),
                str(row["sample_id"]),
                int(row["workflow_step_id"]),
            )
            in keys
        ]

    def _adjacencies(self, workflow_ids: set[int]) -> list[tuple[int, int, int]]:
        if not workflow_ids:
            return []
        source_node = workflow_dag_nodes.alias("source_node")
        target_node = workflow_dag_nodes.alias("target_node")
        with self.engine.connect() as conn:
            rows = conn.execute(
                select(
                    workflow_dag_edges.c.workflow_id,
                    source_node.c.workflow_step_id.label("source_step_id"),
                    target_node.c.workflow_step_id.label("target_step_id"),
                )
                .select_from(workflow_dag_edges)
                .join(
                    source_node,
                    source_node.c.id
                    == workflow_dag_edges.c.from_workflow_dag_node_id,
                )
                .join(
                    target_node,
                    target_node.c.id
                    == workflow_dag_edges.c.to_workflow_dag_node_id,
                )
                .where(workflow_dag_edges.c.workflow_id.in_(workflow_ids))
            ).mappings().all()
        return [
            (
                int(row["workflow_id"]),
                int(row["source_step_id"]),
                int(row["target_step_id"]),
            )
            for row in rows
        ]

    def get_analysis(
        self,
        sample_set_id: int | None = None,
        *,
        after_output_id: int | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        if limit < 1:
            raise ValueError("Analysis chunk limit must be positive")
        candidate_rows = self._rows(
            sample_set_id,
            after_output_id=after_output_id,
            limit=limit + 1,
        )
        has_more = len(candidate_rows) > limit
        rows = candidate_rows[:limit]
        if not rows:
            return {
                "transcriptions": [],
                "disagreements": [],
                "next_cursor": None,
                "has_more": False,
            }

        adjacencies = self._adjacencies({int(row["workflow_id"]) for row in rows})
        outgoing_steps: dict[tuple[int, int], list[int]] = {}
        incoming_steps: dict[tuple[int, int], list[int]] = {}
        for workflow_id, source_step_id, target_step_id in adjacencies:
            outgoing_steps.setdefault((workflow_id, source_step_id), []).append(
                target_step_id
            )
            incoming_steps.setdefault((workflow_id, target_step_id), []).append(
                source_step_id
            )

        neighbor_keys: set[tuple[int, str, int]] = set()
        for row in rows:
            workflow_id = int(row["workflow_id"])
            workflow_step_id = int(row["workflow_step_id"])
            sample_id = str(row["sample_id"])
            for target_step_id in outgoing_steps.get(
                (workflow_id, workflow_step_id), []
            ):
                neighbor_keys.add((workflow_id, sample_id, target_step_id))
            for source_step_id in incoming_steps.get(
                (workflow_id, workflow_step_id), []
            ):
                neighbor_keys.add((workflow_id, sample_id, source_step_id))

        neighbor_rows = self._rows_for_keys(neighbor_keys)
        by_key = {
            (
                int(row["workflow_id"]),
                str(row["sample_id"]),
                int(row["workflow_step_id"]),
            ): row
            for row in [*neighbor_rows, *rows]
        }
        disagreements: list[dict[str, Any]] = []
        relationships_by_output: dict[int, list[dict[str, Any]]] = {
            int(row["id"]): [] for row in rows
        }
        relationship_counts: dict[int, list[int]] = {
            int(row["id"]): [] for row in rows
        }
        comparisons: dict[str, list[dict[str, Any]]] = {}
        emitted_disagreements: set[str] = set()
        for row in rows:
            output_id = int(row["id"])
            workflow_id = int(row["workflow_id"])
            workflow_step_id = int(row["workflow_step_id"])
            sample_id = str(row["sample_id"])
            relationships = [
                ("downstream", workflow_step_id, target_step_id)
                for target_step_id in outgoing_steps.get(
                    (workflow_id, workflow_step_id), []
                )
            ]
            relationships.extend(
                ("upstream", source_step_id, workflow_step_id)
                for source_step_id in incoming_steps.get(
                    (workflow_id, workflow_step_id), []
                )
            )
            for direction, source_step_id, target_step_id in relationships:
                source = by_key.get((workflow_id, sample_id, source_step_id))
                target = by_key.get((workflow_id, sample_id, target_step_id))
                if source is None or target is None:
                    continue
                source_text = str(
                    source.get("parsed_output")
                    or source.get("raw_model_response")
                    or ""
                )
                target_text = str(
                    target.get("parsed_output")
                    or target.get("raw_model_response")
                    or ""
                )
                source_output_id = int(source["id"])
                target_output_id = int(target["id"])
                relationship_id = f"{source_output_id}:{target_output_id}"
                localized = comparisons.get(relationship_id)
                if localized is None:
                    localized = build_disagreements(
                        source_text,
                        target_text,
                        ground_truth=source.get("ground_truth_text"),
                        correctness_outcome=classify_correctness(
                            source_text,
                            target_text,
                            ground_truth=source.get("ground_truth_text"),
                            source_cer=source.get("cer"),
                            target_cer=target.get("cer"),
                        ),
                    )
                    comparisons[relationship_id] = localized
                count = len(localized)
                related = target if direction == "downstream" else source
                relationships_by_output[output_id].append(
                    {
                        "id": relationship_id,
                        "direction": direction,
                        "step_id": int(related["workflow_step_id"]),
                        "step_name": related["workflow_step_name"],
                        "count": count,
                    }
                )
                relationship_counts[output_id].append(count)
                if (
                    direction != "downstream"
                    or relationship_id in emitted_disagreements
                ):
                    continue
                emitted_disagreements.add(relationship_id)
                for item in localized:
                    sequence = item["sequence"]
                    disagreements.append(
                        {
                            "id": f"{relationship_id}:{sequence}",
                            "source_output_id": source_output_id,
                            "target_output_id": target_output_id,
                            "source_step_id": source_step_id,
                            "source_step_name": source["workflow_step_name"],
                            "target_step_id": target_step_id,
                            "target_step_name": target["workflow_step_name"],
                            "target_model": (
                                target.get("workflow_step_executor_config") or {}
                            ).get("model"),
                            "sample_id": source["sample_id"],
                            "sample_name": source["sample_name"],
                            "sample_set_id": int(source["sample_set_id"]),
                            "sample_set_name": source["sample_set_name"],
                            "workflow_id": workflow_id,
                            "workflow_name": source["workflow_name"],
                            "ground_truth": source.get("ground_truth_text"),
                            **{
                                key: value
                                for key, value in item.items()
                                if key != "sequence"
                            },
                        }
                    )

        transcriptions = []
        for row in rows:
            counts = relationship_counts[int(row["id"])]
            transcriptions.append(
                {
                    "id": int(row["id"]),
                    "sample_id": row["sample_id"],
                    "sample_name": row["sample_name"],
                    "sample_set_id": int(row["sample_set_id"]),
                    "sample_set_name": row["sample_set_name"],
                    "sample_mime_type": row["sample_mime_type"],
                    "workflow_id": int(row["workflow_id"]),
                    "workflow_name": row["workflow_name"],
                    "workflow_step_id": int(row["workflow_step_id"]),
                    "workflow_step_name": row["workflow_step_name"],
                    "text": str(
                        row.get("parsed_output")
                        or row.get("raw_model_response")
                        or ""
                    ),
                    "ground_truth": row.get("ground_truth_text"),
                    "cer": row.get("cer"),
                    "disagreement_count": average_disagreement_count(counts),
                    "relationships": relationships_by_output[int(row["id"])],
                    "assembled_model_payload": None,
                    "metadata": {
                        "attempt_no": row["attempt_no"],
                        "parse_status": row["parse_status"],
                        "parse_error": row["parse_error"],
                        "time_elapsed": row["time_elapsed"],
                        "started_at": row["started_at"],
                        "completed_at": row["completed_at"],
                    },
                }
            )
        return {
            "transcriptions": transcriptions,
            "disagreements": disagreements,
            "next_cursor": int(rows[-1]["id"]) if has_more else None,
            "has_more": has_more,
        }

    def get_transcription_payload(self, output_id: int) -> dict[str, Any] | None:
        with self.engine.connect() as conn:
            row = conn.execute(
                select(
                    step_outputs.c.id,
                    raw_outputs.c.assembled_model_payload,
                )
                .join(raw_outputs, raw_outputs.c.id == step_outputs.c.raw_output_id)
                .where(step_outputs.c.id == output_id)
            ).mappings().first()
        if row is None:
            return None
        return {
            "output_id": int(row["id"]),
            "assembled_model_payload": row["assembled_model_payload"],
        }

    def _workflow(self, workflow_id: int) -> dict[str, Any] | None:
        with self.engine.connect() as conn:
            row = conn.execute(
                select(workflows).where(workflows.c.id == workflow_id)
            ).mappings().first()
        return dict(row) if row else None

    def _terminal_step(self, workflow_id: int) -> tuple[int, str, str | None]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                select(
                    workflow_dag_nodes.c.workflow_step_id,
                    workflow_steps.c.name,
                    workflow_steps.c.executor_config,
                )
                .join(
                    workflow_steps,
                    workflow_steps.c.id == workflow_dag_nodes.c.workflow_step_id,
                )
                .outerjoin(
                    workflow_dag_edges,
                    workflow_dag_edges.c.from_workflow_dag_node_id
                    == workflow_dag_nodes.c.id,
                )
                .where(
                    workflow_dag_nodes.c.workflow_id == workflow_id,
                    workflow_dag_edges.c.from_workflow_dag_node_id.is_(None),
                )
            ).mappings().all()
        if len(rows) != 1:
            raise ValueError(
                f"Workflow {workflow_id} must have exactly one terminal step; found {len(rows)}"
            )
        row = rows[0]
        config = row["executor_config"] or {}
        return int(row["workflow_step_id"]), str(row["name"]), config.get("model")

    def _terminal_outputs(
        self, workflow_id: int, workflow_step_id: int
    ) -> dict[str, dict[str, Any]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                select(
                    step_outputs,
                    raw_outputs.c.raw_model_response,
                    step_outputs.c.output.label("parsed_output"),
                    samples.c.name.label("sample_name"),
                    samples.c.ground_truth_text,
                )
                .join(raw_outputs, raw_outputs.c.id == step_outputs.c.raw_output_id)
                .join(
                    execution_jobs,
                    execution_jobs.c.id == step_outputs.c.execution_job_id,
                )
                .join(samples, samples.c.id == step_outputs.c.sample_id)
                .where(
                    step_outputs.c.workflow_id == workflow_id,
                    step_outputs.c.workflow_step_id == workflow_step_id,
                    execution_jobs.c.status == "completed",
                )
            ).mappings().all()
        return {str(row["sample_id"]): dict(row) for row in rows}

    def _sample_set_members(self, sample_set_id: int) -> list[dict[str, str]]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                select(
                    sample_set_samples.c.sample_id,
                    samples.c.name.label("sample_name"),
                )
                .join(samples, samples.c.id == sample_set_samples.c.sample_id)
                .where(sample_set_samples.c.sample_set_id == sample_set_id)
                .order_by(
                    sample_set_samples.c.position,
                    sample_set_samples.c.sample_id,
                )
            ).mappings().all()
        return [
            {
                "sample_id": str(row["sample_id"]),
                "sample_name": str(row["sample_name"]),
            }
            for row in rows
        ]

    def find_workflow_disagreements(
        self,
        *,
        sample_set_id: int,
        source_workflow_id: int,
        target_workflow_id: int,
        agreement_anchor_length: int,
        severity_threshold: float,
        minimum_raw_edits: int,
    ) -> dict[str, Any]:
        if source_workflow_id == target_workflow_id:
            raise ValueError("Source and target workflows must be different")
        source_workflow = self._workflow(source_workflow_id)
        target_workflow = self._workflow(target_workflow_id)
        if source_workflow is None or target_workflow is None:
            raise LookupError("Source or target workflow was not found")
        if int(source_workflow["sample_set_id"]) != sample_set_id or int(
            target_workflow["sample_set_id"]
        ) != sample_set_id:
            raise ValueError("Both workflows must belong to the selected sample set")

        source_step_id, _, _ = self._terminal_step(source_workflow_id)
        target_step_id, _, target_model = self._terminal_step(target_workflow_id)
        source_outputs = self._terminal_outputs(source_workflow_id, source_step_id)
        target_outputs = self._terminal_outputs(target_workflow_id, target_step_id)
        sample_members = self._sample_set_members(sample_set_id)
        compared_samples: list[dict[str, Any]] = []
        skipped_samples: list[dict[str, str]] = []
        for member in sample_members:
            sample_id = member["sample_id"]
            source = source_outputs.get(sample_id)
            target = target_outputs.get(sample_id)
            if source is None or target is None:
                if source is None and target is None:
                    missing = "source and target"
                else:
                    missing = "source" if source is None else "target"
                skipped_samples.append(
                    {
                        "sample_id": sample_id,
                        "sample_name": member["sample_name"],
                        "reason": f"Missing {missing} terminal output",
                    }
                )
                continue
            source_text = str(
                source.get("parsed_output") or source.get("raw_model_response") or ""
            )
            target_text = str(
                target.get("parsed_output") or target.get("raw_model_response") or ""
            )
            outcome = classify_correctness(
                source_text,
                target_text,
                ground_truth=source.get("ground_truth_text"),
                source_cer=source.get("cer"),
                target_cer=target.get("cer"),
            )
            regions = find_disagreement_regions(
                source_text,
                target_text,
                agreement_anchor_length=agreement_anchor_length,
                severity_threshold=severity_threshold,
                minimum_raw_edits=minimum_raw_edits,
                correctness_outcome=outcome,
            )
            compared_samples.append(
                {
                    "sample_id": sample_id,
                    "sample_name": source["sample_name"],
                    "source_output_id": int(source["id"]),
                    "target_output_id": int(target["id"]),
                    "source_text": source_text,
                    "target_text": target_text,
                    "regions": regions,
                }
            )
        return {
            "sample_set_id": sample_set_id,
            "source_workflow_id": source_workflow_id,
            "source_workflow_name": source_workflow["name"],
            "target_workflow_id": target_workflow_id,
            "target_workflow_name": target_workflow["name"],
            "target_model": target_model,
            "agreement_anchor_length": agreement_anchor_length,
            "severity_threshold": severity_threshold,
            "minimum_raw_edits": minimum_raw_edits,
            "samples": compared_samples,
            "skipped_samples": skipped_samples,
        }
