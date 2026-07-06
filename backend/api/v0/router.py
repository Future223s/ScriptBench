from __future__ import annotations

from fastapi import APIRouter

from backend.api.v1.endpoints.events import router as events_router
from backend.api.v1.endpoints.groupings import router as groupings_router
from backend.api.v0.endpoints.health import router as health_router
from backend.api.v1.endpoints.samples import router as samples_router
from backend.api.v0.endpoints.transcription_jobs import (
    router as transcription_jobs_router,
)
from backend.api.v0.endpoints.workflows import router as workflows_router

router = APIRouter()
router.include_router(health_router)
router.include_router(events_router)
router.include_router(groupings_router)
router.include_router(samples_router)
router.include_router(transcription_jobs_router)
router.include_router(workflows_router)
