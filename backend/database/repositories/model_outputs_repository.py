from __future__ import annotations
from typing import Any
from sqlalchemy import func, insert, select, update
from sqlalchemy.engine import Engine
from ..tables.model_outputs_table import model_outputs


class ModelOutputsRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    def insert_attempt(
        self,
        *,
        execution_job_id: int,
        workflow_step_id: int,
        sample_id: str,
        assembled_model_payload: Any,
        raw_model_response: str,
        parsed_output: Any,
        parse_status: str,
        parse_error: str | None,
        time_elapsed: float,
        started_at,
        completed_at,
        **metrics: Any,
    ) -> int:
        with self.engine.begin() as c:
            existing_id = c.execute(
                select(model_outputs.c.model_output_id).where(
                    model_outputs.c.execution_job_id == execution_job_id,
                    model_outputs.c.workflow_step_id == workflow_step_id,
                )
            ).scalar_one_or_none()
            attempt_no = (
                int(
                    c.execute(
                        select(
                            func.coalesce(func.max(model_outputs.c.attempt_no), 0)
                        ).where(model_outputs.c.execution_job_id == execution_job_id)
                    ).scalar_one()
                )
                + 1
            )
            values = {
                "execution_job_id": execution_job_id,
                "workflow_step_id": workflow_step_id,
                "sample_id": sample_id,
                "attempt_no": attempt_no,
                "assembled_model_payload": assembled_model_payload,
                "raw_model_response": raw_model_response,
                "parsed_output": parsed_output,
                "parse_status": parse_status,
                "parse_error": parse_error,
                "time_elapsed": time_elapsed,
                "started_at": started_at,
                "completed_at": completed_at,
                **metrics,
            }
            if existing_id is not None:
                c.execute(
                    update(model_outputs)
                    .where(model_outputs.c.model_output_id == existing_id)
                    .values(**values)
                )
                return int(existing_id)
            return int(
                c.execute(
                    insert(model_outputs)
                    .values(**values)
                    .returning(model_outputs.c.model_output_id)
                ).scalar_one()
            )

    def update_metrics(
        self,
        model_output_id: int,
        *,
        cer: float,
        wer: float,
    ) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                model_outputs.update()
                .where(model_outputs.c.model_output_id == model_output_id)
                .values(
                    cer=cer,
                    wer=wer,
                    hallucination_count=None,
                )
            )
