from __future__ import annotations

import base64
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Protocol

from backend.core.model_client import ModelClient
from backend.database.repositories.execution_jobs_repository import (
    ExecutionJobsRepository,
)
from backend.database.repositories.output_specs_repository import OutputSpecsRepository
from backend.database.repositories.workflow_steps_repository import (
    WorkflowStepsRepository,
)
from backend.models.events import EventPayload
from backend.services.job_events import JobEventHub
from backend.services.output_validator import OutputValidator
from backend.services.payload_builder import PayloadBuilder


logger = logging.getLogger(__name__)


class ModelClientFactory(Protocol):
    def for_step(self, workflow_step: dict[str, Any]) -> ModelClient:
        """Return the model client for a persisted workflow step."""


class ExecutionCoordinator:
    """Build, execute, validate, and persist one execution job."""

    def __init__(
        self,
        repository: ExecutionJobsRepository,
        output_validator: OutputValidator,
        client_factory: ModelClientFactory,
        payload_builder: PayloadBuilder,
        event_hub: JobEventHub,
    ) -> None:
        self.repository = repository
        self.output_validator = output_validator
        self.client_factory = client_factory
        self.payload_builder = payload_builder
        self.event_hub = event_hub
        self.workflow_steps = WorkflowStepsRepository(repository.engine)
        self.output_specs = OutputSpecsRepository(repository.engine)

    async def execute(self, job: dict[str, object]) -> None:
        started_at = datetime.now(timezone.utc)
        started_clock = time.perf_counter()
        await self.event_hub.broadcast(
            self._event("ASSEMBLING", "Assembling execution job.", job)
        )
        payload = self.payload_builder.build(
            workflow_id=int(job["workflow_id"]),
            sample_id=str(job["sample_id"]),
            workflow_dag_node_id=int(job["workflow_dag_node_id"]),
        )
        workflow_step = self._workflow_step(int(job["workflow_step_id"]))
        output_spec = self._output_spec(int(workflow_step["output_spec_id"]))
        client = self.client_factory.for_step(workflow_step)
        await self.event_hub.broadcast(
            self._event("REQUEST_SENT", "Sending transcription request.", job)
        )
        raw_response = await client.transcribe(payload)
        response = self.output_validator.resolve(
            raw_response=raw_response,
            output_spec=output_spec,
        )
        self.output_validator.persist(
            execution_job={
                "execution_job_id": job["execution_job_id"],
                "sample_id": job["sample_id"],
            },
            workflow_step_id=int(job["workflow_step_id"]),
            workflow_dag_node_id=int(job["workflow_dag_node_id"]),
            response=response,
            assembled_payload=self._serialize(payload),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            time_elapsed=time.perf_counter() - started_clock,
        )
        row_status = self.repository.complete_job_and_advance(job)
        await self.event_hub.broadcast(
            self._event(
                "COMPLETED", "Execution job completed.", job, row_status=row_status
            )
        )

    def _workflow_step(self, workflow_step_id: int) -> dict[str, Any]:
        row = self.workflow_steps.fetch(workflow_step_id)
        if row is None:
            raise LookupError(f"Workflow step not found: {workflow_step_id}")
        return dict(row)

    def _output_spec(self, output_spec_id: int) -> dict[str, Any]:
        row = self.output_specs.fetch(output_spec_id)
        if row is None:
            raise LookupError(f"Output spec not found: {output_spec_id}")
        return dict(row)

    @staticmethod
    def _event(
        event: str,
        message: str,
        job: dict[str, object],
        *,
        row_status: str = "running",
    ) -> EventPayload:
        return EventPayload.build(
            event=event,
            message=message,
            rows=[
                {
                    "workflow_id": job.get("workflow_id"),
                    "execution_job_id": job.get("execution_job_id"),
                    "workflow_dag_node_id": job.get("workflow_dag_node_id"),
                    "workflow_step_id": job.get("workflow_step_id"),
                    "status": row_status,
                }
            ],
        )

    @staticmethod
    def _serialize(value: Any) -> Any:
        if isinstance(value, bytes):
            return base64.b64encode(value).decode("ascii")
        if isinstance(value, list):
            return [ExecutionCoordinator._serialize(item) for item in value]
        if isinstance(value, dict):
            return {
                str(key): ExecutionCoordinator._serialize(item)
                for key, item in value.items()
            }
        try:
            json.dumps(value)
        except TypeError:
            return str(value)
        return value
