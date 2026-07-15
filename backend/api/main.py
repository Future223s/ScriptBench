from __future__ import annotations
import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.dependencies import get_engine
from backend.api.v2.router import router as v2_router
from backend.services.file_upload_worker import FileUploadWorker
from backend.services.upload_events import FileUploadEventHub

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.file_upload_event_hub = FileUploadEventHub()
    app.state.file_upload_event_hub.bind_loop(asyncio.get_running_loop())
    app.state.file_upload_worker = None

    engine = get_engine()
    file_upload_worker = FileUploadWorker(
        engine=engine,
        event_hub=app.state.file_upload_event_hub,
    )
    file_upload_worker.start()
    app.state.file_upload_worker = file_upload_worker

    try:
        yield
    finally:
        file_upload_worker = getattr(app.state, "file_upload_worker", None)
        if file_upload_worker is not None:
            await file_upload_worker.stop()


app = FastAPI(title="Economic Upheaval API", lifespan=lifespan)
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
