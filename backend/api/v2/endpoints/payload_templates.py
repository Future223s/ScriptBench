from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_engine
from backend.database.repositories.payload_templates_repository import (
    PayloadTemplatesRepository,
)
from backend.database.repositories.prompt_resources_repository import (
    PromptResourcesRepository,
)
from backend.models.api import ApiDeleteResponse, ApiListResponse, ApiResponse
from backend.models.payload_templates import (
    PayloadTemplateCreateRequest,
    PayloadTemplateDeleteRequest,
    PayloadTemplateRecord,
)


router = APIRouter(tags=["payload-templates-v2"])

def _payload_reference_names(value: Any) -> set[str]:
    if isinstance(value, str):
        return {
            match.group(1)
            for match in re.finditer(r"\{\{\s*([\w]+)\.[\w]+\s*\}\}", value)
        }
    if isinstance(value, list):
        return set().union(*(_payload_reference_names(item) for item in value))
    if isinstance(value, dict):
        return set().union(*(_payload_reference_names(item) for item in value.values()))
    return set()


@router.get(
    "/api/v2/payload-templates", response_model=ApiListResponse[PayloadTemplateRecord]
)
def list_payload_templates(engine=Depends(get_engine)) -> ApiListResponse[PayloadTemplateRecord]:
    items = [
        PayloadTemplateRecord.model_validate(row)
        for row in PayloadTemplatesRepository(engine).list()
    ]
    return ApiListResponse(
        message="Payload templates retrieved successfully.",
        items=items,
        count=len(items),
    )


@router.delete("/api/v2/payload-templates", response_model=ApiDeleteResponse)
def delete_payload_templates(
    payload: PayloadTemplateDeleteRequest,
    engine=Depends(get_engine),
) -> ApiDeleteResponse:
    template_ids = list(dict.fromkeys(payload.ids))
    repository = PayloadTemplatesRepository(engine)
    missing_ids = [item for item in template_ids if repository.fetch(item) is None]
    if missing_ids:
        raise HTTPException(status_code=404, detail="Unknown payload template")
    if repository.list_referencing_workflow_step_ids(template_ids):
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a payload template used by a workflow step",
        )
    with engine.begin() as connection:
        repository.delete_many(template_ids, conn=connection)
    return ApiDeleteResponse(message="Payload templates deleted successfully.")


@router.post(
    "/api/v2/payload-templates", response_model=ApiResponse[PayloadTemplateRecord]
)
def create_payload_template(
    payload: PayloadTemplateCreateRequest,
    engine=Depends(get_engine),
) -> ApiResponse[PayloadTemplateRecord]:
    if not payload.name.strip() or not payload.model_family.strip():
        raise HTTPException(
            status_code=400,
            detail="name and model_family are required",
        )
    resource_names = [resource.name.strip() for resource in payload.resources]
    if any(not name for name in resource_names) or len(resource_names) != len(
        set(resource_names)
    ):
        raise HTTPException(status_code=400, detail="Prompt resource names must be unique")
    unknown_references = _payload_reference_names(payload.payload) - {
        "sample",
        *resource_names,
    }
    if unknown_references:
        raise HTTPException(
            status_code=400,
            detail=(
                "Payload references unknown prompt resource(s): "
                + ", ".join(sorted(unknown_references))
            ),
        )

    resources = PromptResourcesRepository(engine)
    for resource in payload.resources:
        if resource.type == "binding" and resource.source_table == "assets":
            raise HTTPException(
                status_code=400,
                detail="Assets are fixed content and cannot be runtime bindings",
            )
        if resource.type == "content":
            row_id = str(resource.row_id).strip()
            try:
                exists = resources.source_row_exists(resource.source_table, row_id)
            except ValueError as error:
                raise HTTPException(status_code=400, detail="Selected content row is invalid") from error
            if not exists:
                raise HTTPException(status_code=404, detail="Selected content row was not found")

    templates = PayloadTemplatesRepository(engine)
    with engine.begin() as connection:
        template_id = templates.insert(
            {
                "name": payload.name.strip(),
                "model_family": payload.model_family.strip(),
                "payload": payload.payload,
                "status": "draft",
            },
            conn=connection,
        )
        for resource in payload.resources:
            resources.insert(
                {
                    "payload_template_id": template_id,
                    "name": resource.name.strip(),
                    "type": resource.type,
                    "source_table": resource.source_table,
                    "row_key": (
                        str(resource.row_id).strip()
                        if resource.type == "content"
                        else None
                    ),
                    "batch_limit": 1,
                },
                conn=connection,
            )
    record = templates.fetch(template_id)
    if record is None:
        raise HTTPException(status_code=500, detail="Failed to load payload template")
    return ApiResponse(
        message="Payload template created successfully.",
        data=PayloadTemplateRecord.model_validate({**record, "resources": resources.list_for_template(template_id)}),
    )
