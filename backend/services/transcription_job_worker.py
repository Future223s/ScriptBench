from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google.genai import types

from backend.api.dependencies import json_safe, row_to_dict
from backend.core.workflow_config import WorkflowConfig

from backend.database.repositories.transcription_job_samples_repository import TranscriptionJobSamplesRepository
from backend.database.repositories.transcription_jobs_repository import TranscriptionJobsRepository
from backend.database.repositories.workflows_repository import WorkflowsRepository

from backend.services.gemini import GeminiClient
from backend.services.job_events import JobEventHub, build_job_event

logger = logging.getLogger(__name__)

def _rehydrate_contents(contents: Any) -> list[Any]:
    if not isinstance(contents, list):
        return []

    rehydrated: list[Any] = []
    for item in contents:
        if not isinstance(item, dict):
            continue
        parts: list[Any] = []
        for part in item.get("parts", []):
            if not isinstance(part, dict):
                continue
            if "text" in part:
                parts.append(types.Part.from_text(text=str(part["text"])))
                continue
            file_data = part.get("file_data")
            if isinstance(file_data, dict):
                file_uri = file_data.get("file_uri")
                if file_uri is not None:
                    parts.append(
                        types.Part.from_uri(
                            file_uri=str(file_uri),
                            mime_type=file_data.get("mime_type"),
                        )
                    )
                    continue
            file_uri = part.get("file_uri")
            if file_uri is not None:
                parts.append(
                    types.Part.from_uri(
                        file_uri=str(file_uri),
                        mime_type=part.get("mime_type"),
                    )
                )
        rehydrated.append(types.Content(role=str(item.get("role", "user")), parts=parts))
    return rehydrated


class TranscriptionJobWorker:
    def __init__(
        self,
        *,
        engine,
        event_hub: JobEventHub | None,
        poll_interval_seconds: float = 1.5,
        max_concurrency: int = 20,
    ) -> None:
        self.engine = engine
        self.event_hub = event_hub
        self.poll_interval_seconds = poll_interval_seconds
        self.max_concurrency = max(1, int(max_concurrency))
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(
            target=self._run,
            name="transcription-job-worker",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def _publish(self, payload: dict[str, Any]) -> None:
        if self.event_hub is None:
            return
        self.event_hub.broadcast_threadsafe(payload)

    def _load_job_payload(self, job_id: int) -> dict[str, Any] | None:
        transcription_jobs_repository = TranscriptionJobsRepository(self.engine)
        transcription_job_samples_repository = TranscriptionJobSamplesRepository(self.engine)
        job_row = transcription_jobs_repository.fetch_transcription_job(job_id)
        if job_row is None:
            return None
        payload = row_to_dict(job_row)
        payload["sample_ids"] = transcription_job_samples_repository.fetch_transcription_job_samples(job_id)
        return payload

    def _claim_next_jobs(self, *, limit: int) -> list[dict[str, Any]]:
        transcription_jobs_repository = TranscriptionJobsRepository(self.engine)
        queued_jobs = transcription_jobs_repository.fetch_queued_transcription_jobs(limit=limit)
        if not queued_jobs:
            return []

        now = datetime.now(timezone.utc)
        claimed_jobs: list[dict[str, Any]] = []
        for job_row in queued_jobs:
            job_id = int(job_row["job_id"])
            transcription_jobs_repository.update_transcription_job(
                job_id,
                status="running",
                started_at=now,
                failure_reason=None,
                raw_content=None,
                time_elapsed=None,
            )
            payload = self._load_job_payload(job_id)
            if payload is None:
                continue
            payload["status"] = "running"
            payload["started_at"] = now.isoformat()
            payload["failure_reason"] = None
            payload["raw_content"] = None
            payload["time_elapsed"] = None
            claimed_jobs.append(payload)
        return claimed_jobs

    async def _transcribe_job(self, job_payload: dict[str, Any]) -> str:
        workflow_id = int(job_payload["workflow_id"])
        workflows_repository = WorkflowsRepository(self.engine)
        workflow_row = workflows_repository.fetch_workflow(workflow_id)
        if workflow_row is None:
            raise RuntimeError(f"Workflow not found for job {job_payload['job_id']}")

        resolved_prompt = job_payload.get("resolved_prompt")
        if isinstance(resolved_prompt, str):
            resolved_prompt = json.loads(resolved_prompt)
        contents = []
        if isinstance(resolved_prompt, dict):
            contents = _rehydrate_contents(resolved_prompt.get("contents"))

        workflow_config = WorkflowConfig(
            workflow_name=str(workflow_row["workflow_name"]),
            stage=str(workflow_row["workflow_stage"]),
            model_family=str(workflow_row["model_family"]),
            model=str(workflow_row["model"]) if workflow_row["model"] is not None else None,
            workflow_id=workflow_id,
            prompt_template=workflow_row["prompt_spec"],
            status=str(workflow_row["status"]),
        )
        client = GeminiClient(workflow_config=workflow_config, image_dir=Path("."))
        return await client.transcribe(contents=contents)

    async def _process_job(self, job_payload: dict[str, Any]) -> None:
        job_id = int(job_payload["job_id"])
        self._publish(
            build_job_event(
                event="job.running",
                message="Model request sent.",
                job_payload=job_payload,
            )
        )

        started_at = datetime.now(timezone.utc)
        transcription_jobs_repository = TranscriptionJobsRepository(self.engine)
        try:
            raw_content = await self._transcribe_job(job_payload)
            completed_at = datetime.now(timezone.utc)
            time_elapsed = (completed_at - started_at).total_seconds()
            transcription_jobs_repository.update_transcription_job(
                job_id,
                status="completed",
                raw_content=raw_content,
                failure_reason=None,
                time_elapsed=time_elapsed,
                completed_at=completed_at,
            )
            refreshed_job = self._load_job_payload(job_id)
            if refreshed_job is not None:
                refreshed_job["status"] = "completed"
                refreshed_job["raw_content"] = json_safe(raw_content)
                refreshed_job["time_elapsed"] = time_elapsed
                refreshed_job["completed_at"] = completed_at.isoformat()
                self._publish(
                    build_job_event(
                        event="job.completed",
                        message="Transcription completed.",
                        job_payload=refreshed_job,
                    )
                )
        except Exception as exc:
            completed_at = datetime.now(timezone.utc)
            time_elapsed = (completed_at - started_at).total_seconds()
            transcription_jobs_repository.update_transcription_job(
                job_id,
                status="failed",
                failure_reason=str(exc),
                time_elapsed=time_elapsed,
                completed_at=completed_at,
            )
            refreshed_job = self._load_job_payload(job_id)
            if refreshed_job is not None:
                refreshed_job["status"] = "failed"
                refreshed_job["failure_reason"] = str(exc)
                refreshed_job["time_elapsed"] = time_elapsed
                refreshed_job["completed_at"] = completed_at.isoformat()
                self._publish(
                    build_job_event(
                        event="job.failed",
                        message=str(exc),
                        job_payload=refreshed_job,
                    )
                )
            logger.exception("Failed to process transcription job %s", job_id)

    async def _process_job_safe(self, job_payload: dict[str, Any]) -> None:
        try:
            await self._process_job(job_payload)
        except Exception:
            logger.exception("Unexpected failure while processing transcription job %s", job_payload.get("job_id"))

    async def _run_once(self) -> bool:
        active_tasks: set[asyncio.Task[None]] = set()
        claimed_any_jobs = False
        queue_exhausted = False

        async def refill_capacity() -> bool:
            nonlocal claimed_any_jobs, queue_exhausted
            if self._stop_event.is_set():
                return False
            if len(active_tasks) >= self.max_concurrency:
                return False
            if queue_exhausted:
                return False

            slots = self.max_concurrency - len(active_tasks)
            job_payloads = await asyncio.to_thread(self._claim_next_jobs, limit=slots)
            if not job_payloads:
                queue_exhausted = True
                return False

            claimed_any_jobs = True
            for job_payload in job_payloads:
                task = asyncio.create_task(self._process_job_safe(job_payload))
                active_tasks.add(task)
            return True

        while await refill_capacity():
            pass

        while active_tasks:
            done, _pending = await asyncio.wait(
                active_tasks,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if not done:
                break
            active_tasks.difference_update(done)
            while len(active_tasks) < self.max_concurrency and await refill_capacity():
                pass

        return claimed_any_jobs

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                did_work = asyncio.run(self._run_once())
                if not did_work:
                    time.sleep(self.poll_interval_seconds)
            except Exception:
                logger.exception("Transcription job worker loop failed")
                time.sleep(self.poll_interval_seconds)
