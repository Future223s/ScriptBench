from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Any
from sqlalchemy.engine import Engine
from backend.database.repositories.step_outputs_repository import (
    StepOutputsRepository,
)
from backend.services.scoring import ErrorComputationService


@dataclass(frozen=True)
class ResolvedOutput:
    raw_response: str
    parsed_output: Any
    parse_status: str
    parse_error: str | None = None


class OutputValidator:
    def __init__(self, engine: Engine):
        self.repository = StepOutputsRepository(engine)
        self.error_computation = ErrorComputationService(engine)

    def resolve(self, *, raw_response: str, output_spec: dict[str, Any]):
        if output_spec.get("type") == "plain-text":
            return ResolvedOutput(raw_response, raw_response, "success")
        try:
            return ResolvedOutput(raw_response, json.loads(raw_response), "success")
        except json.JSONDecodeError as e:
            return ResolvedOutput(raw_response, None, "failed", str(e))

    def persist(
        self,
        *,
        execution_job,
        workflow_step_id,
        response,
        assembled_payload,
        started_at,
        completed_at,
        time_elapsed,
        **metrics,
    ):
        output_id = self.repository.insert_attempt(
            execution_job_id=int(execution_job["id"]),
            workflow_id=int(execution_job["workflow_id"]),
            workflow_step_id=workflow_step_id,
            sample_id=str(execution_job["sample_id"]),
            assembled_model_payload=assembled_payload,
            raw_model_response=response.raw_response,
            parsed_output=response.parsed_output,
            parse_status=response.parse_status,
            parse_error=response.parse_error,
            time_elapsed=time_elapsed,
            started_at=started_at,
            completed_at=completed_at,
            **metrics,
        )
        if response.parse_status == "success" and isinstance(
            response.parsed_output, str
        ):
            self.error_computation.score(
                step_output_id=output_id,
                sample_id=str(execution_job["sample_id"]),
                output_text=response.parsed_output,
            )
        return output_id
