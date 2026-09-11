from __future__ import annotations
import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.api.dependencies import get_engine
from backend.api.v2.router import router as v2_router
from backend.database.repositories.execution_jobs_repository import ExecutionJobsRepository
from backend.services.execution_coordinator import ExecutionCoordinator
from backend.services.execution_worker import ExecutionWorker
from backend.services.payload_builder import PayloadBuilder
from backend.services.dev_settings import DevSettings
from backend.services.step_executor_factory import StepExecutorFactory
from backend.services.output_validator import OutputValidator
from backend.services.job_events import JobEventHub

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.dev_settings = DevSettings.from_environment()
    app.state.engine = get_engine()
    app.state.job_events = JobEventHub()
    app.state.job_events.bind_loop(asyncio.get_running_loop())
    execution_repository = ExecutionJobsRepository(app.state.engine)
    payload_builder = PayloadBuilder(app.state.engine)
    app.state.execution_worker = ExecutionWorker(
        execution_repository,
        ExecutionCoordinator(
            repository=execution_repository,
            output_validator=OutputValidator(app.state.engine),
            executor_factory=StepExecutorFactory(app.state.engine, settings=app.state.dev_settings),
            payload_builder=payload_builder,
            event_hub=app.state.job_events,
        ),
        event_hub=app.state.job_events,
    )
    try:
        yield
    finally:
        await app.state.execution_worker.shutdown()
        app.state.engine.dispose()
        del app.state.engine
        del app.state.execution_worker
        del app.state.job_events


app = FastAPI(title="Economic Upheaval API", lifespan=lifespan)


def get_lifecycle_engine(request: Request):
    return request.app.state.engine


app.dependency_overrides[get_engine] = get_lifecycle_engine
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(v2_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.api.main:app", host="127.0.0.1", port=8000, reload=False)
