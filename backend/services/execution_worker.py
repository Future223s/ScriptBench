from __future__ import annotations
import asyncio
import logging
from backend.database.repositories.execution_jobs_repository import (
    ExecutionJobsRepository,
)
from backend.models.events import EventPayload
from backend.services.execution_coordinator import ExecutionCoordinator
from backend.services.job_events import JobEventHub

logger = logging.getLogger(__name__)


class ExecutionWorker:
    def __init__(
        self,
        repository: ExecutionJobsRepository,
        coordinator: ExecutionCoordinator,
        *,
        max_concurrency: int = 20,
        poll_interval_seconds: float = 0.25,
        event_hub: JobEventHub | None = None,
        **_: object,
    ) -> None:
        (
            self.repository,
            self.coordinator,
            self.max_concurrency,
            self.poll_interval_seconds,
            self.event_hub,
        ) = (repository, coordinator, max_concurrency, poll_interval_seconds, event_hub)
        self._tasks = set()
        self._loop_task = None
        self._stop_requested = asyncio.Event()
        self._wake_requested = asyncio.Event()
        self._paused_workflows = set()

    @property
    def running(self):
        return self._loop_task is not None and not self._loop_task.done()

    @property
    def active_jobs(self):
        return len(self._tasks)

    def start(self, workflow_id=None):
        if workflow_id is not None:
            self._paused_workflows.discard(workflow_id)
        if not self.running:
            self._loop_task = asyncio.create_task(self._run())
        self._stop_requested.clear()
        self._wake_requested.set()

    def stop(self, workflow_id=None):
        if workflow_id is None:
            self._stop_requested.set()
        else:
            self._paused_workflows.add(workflow_id)

    def wake(self):
        self._wake_requested.set()

    async def shutdown(self):
        self.stop()
        if self._loop_task:
            await self._loop_task
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _run(self):
        while not self._stop_requested.is_set():
            self._tasks = {t for t in self._tasks if not t.done()}
            while len(self._tasks) < self.max_concurrency:
                try:
                    job = self.repository.claim_next_job(self._paused_workflows)
                except Exception:
                    logger.exception("Could not claim execution job")
                    break
                if job is None:
                    break
                self._tasks.add(asyncio.create_task(self._run_job(job)))
            self._wake_requested.clear()
            try:
                await asyncio.wait_for(
                    self._wake_requested.wait(), timeout=self.poll_interval_seconds
                )
            except asyncio.TimeoutError:
                pass

    async def _run_job(self, job):
        try:
            await self.coordinator.execute(job)
        except Exception as exc:
            self.stop(int(job["workflow_id"]))
            self.repository.set_job_failed(int(job["id"]), str(exc))
            if self.event_hub:
                await self.event_hub.broadcast(
                    EventPayload.build(
                        event="FAILED",
                        message="Execution job failed.",
                        rows=[
                            {**job, "status": "pending", "error_message": str(exc)}
                        ],
                    )
                )
