from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Any
from sqlalchemy.engine import Engine
from backend.database.repositories.step_outputs_repository import (
    StepOutputsRepository,
)
from backend.database.repositories.raw_outputs_repository import RawOutputsRepository
from backend.services.scoring import ErrorComputationService


@dataclass(frozen=True)
class ResolvedOutput:
    raw_response: str
    parsed_output: Any
    parse_status: str
    parse_error: str | None = None
    individual_outputs: list[dict[str, Any]] | None = None
    complete_output: Any = None


class OutputValidator:
    def __init__(self, engine: Engine):
        self.step_outputs = StepOutputsRepository(engine)
        self.raw_outputs = RawOutputsRepository(engine)
        self.error_computation = ErrorComputationService(engine)

    def resolve(
        self,
        *,
        raw_response: str,
        output_spec: dict[str, Any],
        execution_scope: str = "samples",
        output_scope: str = "samples",
        entity_ids: list[str] | None = None,
    ):
        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            return ResolvedOutput(raw_response, None, "failed", str(e))
        expected = [str(value) for value in entity_ids or []]
        if not isinstance(parsed, dict):
            return ResolvedOutput(
                raw_response, None, "failed", "Output must be a JSON object keyed by stable entity IDs."
            )
        actual = [str(value) for value in parsed]
        if sorted(actual) != sorted(expected):
            return ResolvedOutput(
                raw_response,
                None,
                "failed",
                "Output keys must match the resolved output entity IDs exactly once.",
            )
        item_schema = output_spec.get("item_schema") or {"type": "string"}
        for entity_id in expected:
            error = self._validate_item(parsed[entity_id], item_schema)
            if error:
                return ResolvedOutput(raw_response, None, "failed", error)
        individual = [
            {"entity_id": entity_id, "output": parsed[entity_id]}
            for entity_id in expected
        ]
        return ResolvedOutput(
            raw_response,
            parsed,
            "success",
            individual_outputs=individual,
            complete_output=parsed,
        )

    @staticmethod
    def _validate_item(value: Any, schema: dict[str, Any]) -> str | None:
        if schema.get("type") == "string":
            return None if isinstance(value, str) else "Output item must be a string."
        if schema.get("type") != "object" or not isinstance(value, dict):
            return "Output item must be an object."
        python_types = {"string": str, "number": (int, float), "boolean": bool}
        for name, definition in (schema.get("properties") or {}).items():
            if definition.get("required", False) and name not in value:
                return f"Output item is missing required property: {name}"
            if name in value:
                expected_type = python_types.get(definition.get("type"))
                wrong_type = expected_type is not None and not isinstance(value[name], expected_type)
                if definition.get("type") == "number" and isinstance(value[name], bool):
                    wrong_type = True
                if wrong_type:
                    return f"Output property has the wrong type: {name}"
        return None

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
    ) -> tuple[int, list[int]]:
        raw_output_id = self.raw_outputs.insert_attempt(
            execution_job_id=int(execution_job["id"]),
            workflow_id=int(execution_job["workflow_id"]),
            workflow_step_id=workflow_step_id,
            assembled_model_payload=assembled_payload,
            raw_model_response=response.raw_response,
            parsed_output=response.parsed_output,
            raw_individual_outputs=response.individual_outputs,
            complete_output=response.complete_output,
            parse_status=response.parse_status,
            parse_error=response.parse_error,
            time_elapsed=time_elapsed,
            started_at=started_at,
            completed_at=completed_at,
        )
        if response.parse_status != "success":
            return raw_output_id, []
        output_ids = self.step_outputs.publish(
            raw_output_id=raw_output_id,
            execution_job=execution_job,
            workflow_step_id=workflow_step_id,
            individual_outputs=response.individual_outputs,
            complete_output=response.complete_output,
        )
        individual_by_entity_id = {
            str(item["entity_id"]): item.get("output")
            for item in (response.individual_outputs or [])
            if isinstance(item, dict) and item.get("entity_id") is not None
        }
        for step_output_id, output_ref in zip(
            output_ids,
            execution_job.get("output_refs") or [],
            strict=True,
        ):
            if str(output_ref.get("entity_type")) != "sample":
                continue
            sample_id = str(output_ref["entity_id"])
            output_text = individual_by_entity_id.get(sample_id)
            if isinstance(output_text, str):
                self.error_computation.score(
                    step_output_id=step_output_id,
                    sample_id=sample_id,
                    output_text=output_text,
                )
        return raw_output_id, output_ids
