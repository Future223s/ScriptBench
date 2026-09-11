from __future__ import annotations

from fastapi import APIRouter

from backend.api.v2.endpoints.derivatives import router as derivatives_router
from backend.api.v2.endpoints.derivative_groups import router as derivative_groups_router
from backend.api.v2.endpoints.assets import router as assets_router
from backend.api.v2.endpoints.samples import router as samples_router
from backend.api.v2.endpoints.sample_sets import router as sample_sets_router
from backend.api.v2.endpoints.payload_templates import (
    router as payload_templates_router,
)
from backend.api.v2.endpoints.output_specs import router as output_specs_router
from backend.api.v2.endpoints.workflow_steps import router as workflow_steps_router
from backend.api.v2.endpoints.workflows import router as workflows_router
from backend.api.v2.endpoints.workflow_dag import router as workflow_dag_router
from backend.api.v2.endpoints.execution import router as execution_router

from backend.api.v2.endpoints.dev_settings import router as dev_settings_router

router = APIRouter()
router.include_router(dev_settings_router)
router.include_router(samples_router)
router.include_router(sample_sets_router)
router.include_router(assets_router)
router.include_router(derivative_groups_router)
router.include_router(derivatives_router)
router.include_router(payload_templates_router)
router.include_router(output_specs_router)
router.include_router(workflow_steps_router)
router.include_router(workflows_router)
router.include_router(workflow_dag_router)
router.include_router(execution_router)
