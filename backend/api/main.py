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
from backend.api.v1.router import router as v1_router
from backend.services.job_events import JobEventHub
from backend.services.transcription_job_worker import TranscriptionJobWorker

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.job_event_hub = JobEventHub()
    app.state.job_event_hub.bind_loop(asyncio.get_running_loop())
    app.state.job_worker = None

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
app.include_router(v1_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="127.0.0.1", port=8000, reload=False)
