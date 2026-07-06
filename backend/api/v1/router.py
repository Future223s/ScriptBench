from __future__ import annotations

from fastapi import APIRouter

from backend.api.v1.endpoints.samples import router as samples_router
from backend.api.v1.endpoints.groupings import router as groupings_router
from backend.api.v1.endpoints.sample_sets import router as sample_sets_router
from backend.api.v1.endpoints.workflows import router as workflows_router
from backend.api.v1.endpoints.jobs import router as jobs_router
from backend.api.v1.endpoints.events import router as events_router

router = APIRouter()
router.include_router(sample_sets_router)
router.include_router(samples_router)
router.include_router(groupings_router)
router.include_router(jobs_router)
router.include_router(workflows_router)
router.include_router(events_router)
