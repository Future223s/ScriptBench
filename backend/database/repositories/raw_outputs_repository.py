from __future__ import annotations

from typing import Any

from sqlalchemy import func, insert, select
from sqlalchemy.engine import Engine

from ..tables.raw_outputs_table import raw_outputs


class RawOutputsRepository:
    """Append-only provider attempt history for execution jobs."""

    def __init__(self, engine: Engine):
        self.engine = engine

    def insert_attempt(
        self,
        *,
        execution_job_id: int,
        workflow_id: int,
        workflow_step_id: int,
        assembled_model_payload: Any,
        raw_model_response: str,
        parsed_output: Any,
        raw_individual_outputs: Any,
        complete_output: Any,
        parse_status: str,
        parse_error: str | None,
        time_elapsed: float,
        started_at,
        completed_at,
    ) -> int:
        with self.engine.begin() as connection:
            attempt_no = int(
                connection.execute(
                    select(func.coalesce(func.max(raw_outputs.c.attempt_no), 0)).where(
                        raw_outputs.c.execution_job_id == execution_job_id
                    )
                ).scalar_one()
            ) + 1
            return int(
                connection.execute(
                    insert(raw_outputs)
                    .values(
                        execution_job_id=execution_job_id,
                        workflow_id=workflow_id,
                        workflow_step_id=workflow_step_id,
                        attempt_no=attempt_no,
                        assembled_model_payload=assembled_model_payload,
                        raw_model_response=raw_model_response,
                        parsed_output=parsed_output,
                        raw_individual_outputs=raw_individual_outputs,
                        complete_output=complete_output,
                        parse_status=parse_status,
                        parse_error=parse_error,
                        time_elapsed=time_elapsed,
                        started_at=started_at,
                        completed_at=completed_at,
                    )
                    .returning(raw_outputs.c.id)
                ).scalar_one()
            )
