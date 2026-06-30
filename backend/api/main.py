from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI

from backend.api.dependencies import get_engine
from backend.api.routes.events import router as events_router
from backend.api.routes.dashboard import router as dashboard_router
from backend.api.routes.groupings import router as groupings_router
from backend.api.routes.samples import router as samples_router
from backend.api.routes.transcription_jobs import router as transcription_jobs_router
from backend.api.routes.workflows import router as workflows_router
from backend.api.routes.workspaces import router as workspaces_router
from backend.api.routes.v1_sample_sets import router as v1_sample_sets_router
from backend.api.routes.v1_workflows import router as v1_workflows_router
from backend.services.job_events import JobEventHub
from backend.services.transcription_job_worker import TranscriptionJobWorker

def _job_worker_enabled() -> bool:
    return os.getenv("SCRIPTBENCH_DISABLE_JOB_WORKER", "").strip() != "1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.job_event_hub = JobEventHub()
    app.state.job_event_hub.bind_loop(asyncio.get_running_loop())
    app.state.job_worker = None

    if _job_worker_enabled():
        engine = get_engine()
        worker = TranscriptionJobWorker(
            engine=engine,
            event_hub=app.state.job_event_hub,
        )
        worker.start()
        app.state.job_worker = worker

    try:
        yield
    finally:
        worker = getattr(app.state, "job_worker", None)
        if worker is not None:
            worker.stop()


app = FastAPI(title="Economic Upheaval API", lifespan=lifespan)
app.include_router(dashboard_router)
app.include_router(events_router)
app.include_router(groupings_router)
app.include_router(samples_router)
app.include_router(transcription_jobs_router)
app.include_router(workflows_router)
app.include_router(workspaces_router)
app.include_router(v1_sample_sets_router)
app.include_router(v1_workflows_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    os.environ.setdefault("SCRIPTBENCH_DISABLE_JOB_WORKER", "0")
    import uvicorn

    uvicorn.run("backend.api.main:app", host="127.0.0.1", port=8000, reload=False)
