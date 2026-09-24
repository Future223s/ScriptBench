from __future__ import annotations

from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Engine

from ..tables.step_outputs_table import step_outputs


class StepOutputsRepository:
    """Publish the canonical outputs that downstream workflow steps may consume."""

    def __init__(self, engine: Engine):
        self.engine = engine

    @staticmethod
    def _individual_value(item: dict[str, Any]) -> Any:
        if "output" in item:
            return item["output"]
        return {key: value for key, value in item.items() if key != "entity_id"}

    def publish(
        self,
        *,
        raw_output_id: int,
        execution_job: dict[str, Any],
        workflow_step_id: int,
        individual_outputs: list[dict[str, Any]] | None,
        complete_output: Any,
    ) -> list[int]:
        refs = list(execution_job.get("output_refs") or [])
        by_entity_id = {
            str(item["entity_id"]): self._individual_value(item)
            for item in (individual_outputs or [])
            if isinstance(item, dict) and item.get("entity_id") is not None
        }
        if not refs:
            return []

        published_ids: list[int] = []
        with self.engine.begin() as connection:
            for ref in refs:
                entity_type = str(ref["entity_type"])
                entity_id = str(ref["entity_id"])
                output = by_entity_id.get(entity_id, complete_output)
                values = {
                    "raw_output_id": raw_output_id,
                    "execution_job_id": int(execution_job["id"]),
                    "workflow_id": int(execution_job["workflow_id"]),
                    "workflow_step_id": workflow_step_id,
                    "sample_id": (
                        entity_id
                        if entity_type == "sample"
                        else execution_job.get("sample_id")
                    ),
                    "output_scope": str(execution_job["output_scope"]),
                    "entity_type": entity_type,
                    "entity_key": entity_id,
                    "output": output,
                    "cer": None,
                    "wer": None,
                    "hallucination_count": None,
                }
                existing_id = connection.execute(
                    select(step_outputs.c.id).where(
                        step_outputs.c.execution_job_id == int(execution_job["id"]),
                        step_outputs.c.workflow_step_id == workflow_step_id,
                        step_outputs.c.entity_type == entity_type,
                        step_outputs.c.entity_key == entity_id,
                    )
                ).scalar_one_or_none()
                if existing_id is None:
                    existing_id = connection.execute(
                        insert(step_outputs)
                        .values(**values)
                        .returning(step_outputs.c.id)
                    ).scalar_one()
                else:
                    connection.execute(
                        update(step_outputs)
                        .where(step_outputs.c.id == existing_id)
                        .values(**values)
                    )
                published_ids.append(int(existing_id))

            connection.execute(
                delete(step_outputs).where(
                    step_outputs.c.execution_job_id == int(execution_job["id"]),
                    step_outputs.c.workflow_step_id == workflow_step_id,
                    step_outputs.c.id.not_in(published_ids),
                )
            )
        return published_ids

    def update_metrics(
        self,
        step_output_id: int,
        *,
        cer: float,
        wer: float,
    ) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(step_outputs)
                .where(step_outputs.c.id == step_output_id)
                .values(cer=cer, wer=wer, hallucination_count=None)
            )
