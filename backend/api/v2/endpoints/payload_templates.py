from __future__ import annotations

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

    allowed_fields = {
        "derivatives": {
            "id", "name", "sample_id", "derivative_group_id",
            "category", "mime_type",
        },
        "samples": {
            "id", "name", "mime_type", "ground_truth_text",
        },
        "step_outputs": {
            "id", "execution_job_id", "workflow_id", "workflow_step_id",
            "sample_id", "attempt_no", "parsed_output", "parse_status",
            "parse_error", "cer", "wer", "hallucination_count", "time_elapsed",
            "started_at", "completed_at", "created_at",
        },
    }
    for resource in payload.resources:
        for condition in resource.conditions:
            if condition.field_name not in allowed_fields[resource.source_table]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported prompt resource field: {resource.source_table}.{condition.field_name}",
                )

            if condition.value_type == "sample-field" and condition.value not in allowed_fields["samples"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported sample field: {condition.value}",
                )

    templates = PayloadTemplatesRepository(engine)
    resources = PromptResourcesRepository(engine)
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
            resource_id = resources.insert(
                {
                    "payload_template_id": template_id,
                    "name": resource.name.strip(),
                    "source_table": resource.source_table,
                    "batch_limit": resource.batch_limit,
                },
                conn=connection,
            )
            for position, condition in enumerate(resource.conditions):
                resources.insert_condition(
                    {
                        "prompt_resource_id": resource_id,
                        "field_name": condition.field_name,
                        "operator": condition.operator,
                        "value_type": condition.value_type,
                        "value": condition.value,
                        "position": position,
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
