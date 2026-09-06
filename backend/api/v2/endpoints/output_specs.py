from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_engine
from backend.database.repositories.output_specs_repository import OutputSpecsRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.output_specs import OutputSpecCreateRequest, OutputSpecRecord

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


@router.post("/api/v2/output-specs", response_model=ApiResponse[OutputSpecRecord])
def create_output_spec(
    payload: OutputSpecCreateRequest, engine=Depends(get_engine)
) -> ApiResponse[OutputSpecRecord]:
    name = payload.output_spec_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="output_spec_name is required")
    repository = OutputSpecsRepository(engine)
    output_spec_id = repository.insert(
        {
            "output_spec_name": name,
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
        "Created output specification (output_spec_id=%s, output_spec_name=%s)",
        output_spec_id,
        name,
    )
    return ApiResponse[OutputSpecRecord](
        message="Output specification created successfully.", data=record
    )
