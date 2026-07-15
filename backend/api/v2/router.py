from __future__ import annotations

from fastapi import APIRouter

from backend.api.v2.endpoints.artifacts import router as artifacts_router
from backend.api.v2.endpoints.artifact_groups import router as artifact_groups_router
from backend.api.v2.endpoints.assets import router as assets_router
from backend.api.v2.endpoints.samples import router as samples_router

router = APIRouter()
router.include_router(samples_router)
router.include_router(assets_router)
router.include_router(artifact_groups_router)
router.include_router(artifacts_router)
