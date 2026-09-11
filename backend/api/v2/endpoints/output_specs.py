from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_engine
from backend.database.repositories.output_specs_repository import OutputSpecsRepository
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.output_specs import (
    OutputSpecCreateRequest,
    OutputSpecDeleteRequest,
    OutputSpecRecord,
)

router = APIRouter(tags=["output-specs-v2"])
logger = logging.getLogger(__name__)


@router.get("/api/v2/output-specs", response_model=ApiListResponse[OutputSpecRecord])
def list_output_specs(engine=Depends(get_engine)) -> ApiListResponse[OutputSpecRecord]:
    items = [
        OutputSpecRecord.model_validate(row)
        for row in OutputSpecsRepository(engine).list()
    ]
    logger.info("Listed output specifications (output_spec_count=%s)", len(items))
    return ApiListResponse[OutputSpecRecord](
        message="Output specifications retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.delete("/api/v2/output-specs", response_model=ApiDeleteResponse)
def delete_output_specs(
    payload: OutputSpecDeleteRequest, engine=Depends(get_engine)
) -> ApiDeleteResponse:
    output_spec_ids = list(dict.fromkeys(payload.ids))
    repository = OutputSpecsRepository(engine)
    missing_ids = [item for item in output_spec_ids if repository.fetch(item) is None]
    if missing_ids:
        raise HTTPException(status_code=404, detail="Unknown output specification")
    if repository.list_referencing_workflow_step_ids(output_spec_ids):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete an output specification used by a workflow step",
        )
    with engine.begin() as connection:
        repository.delete_many(output_spec_ids, conn=connection)
    return ApiDeleteResponse(message="Output specifications deleted successfully.")


@router.post("/api/v2/output-specs", response_model=ApiResponse[OutputSpecRecord])
def create_output_spec(
    payload: OutputSpecCreateRequest, engine=Depends(get_engine)
) -> ApiResponse[OutputSpecRecord]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    repository = OutputSpecsRepository(engine)
    output_spec_id = repository.insert(
        {
            "name": name,
            "type": payload.type,
            "item_schema": payload.item_schema,
            "instructions": (
                payload.instructions.strip() if payload.instructions else None
            ),
            "status": "draft",
        }
    )
    row = repository.fetch(output_spec_id)
    if row is None:
        raise HTTPException(
            status_code=500, detail="Failed to load output specification after create"
        )
    record = OutputSpecRecord.model_validate(row)
    logger.info(
        "Created output specification (output_spec_id=%s, name=%s)",
        output_spec_id,
        name,
    )
    return ApiResponse[OutputSpecRecord](
        message="Output specification created successfully.", data=record
    )
