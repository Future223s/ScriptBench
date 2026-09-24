from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend.api.dependencies import get_engine
from backend.database.repositories.analysis_repository import AnalysisRepository
from backend.models.analysis import (
    FindDisagreementsRequest,
    SampleSetAnalysis,
    TranscriptionPayload,
    WorkflowDisagreementComputation,
)
from backend.models.api import ApiResponse

router = APIRouter(tags=["analysis-v2"])
logger = logging.getLogger(__name__)


@router.get(
    "/api/v2/analysis",
    response_model=ApiResponse[SampleSetAnalysis],
)
def get_global_analysis(
    cursor: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    engine=Depends(get_engine),
) -> ApiResponse[SampleSetAnalysis]:
    data = SampleSetAnalysis.model_validate(
        AnalysisRepository(engine).get_analysis(
            after_output_id=cursor,
            limit=limit,
        )
    )
    logger.info(
        "Loaded global analysis chunk "
        "(cursor=%s, transcriptions=%s, disagreements=%s, has_more=%s)",
        cursor,
        len(data.transcriptions),
        len(data.disagreements),
        data.has_more,
    )
    return ApiResponse(message="Global analysis chunk retrieved.", data=data)


@router.get(
    "/api/v2/sample-sets/{sample_set_id}/analysis",
    response_model=ApiResponse[SampleSetAnalysis],
)
def get_sample_set_analysis(
    sample_set_id: int = Path(..., ge=1),
    cursor: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    engine=Depends(get_engine),
) -> ApiResponse[SampleSetAnalysis]:
    data = SampleSetAnalysis.model_validate(
        AnalysisRepository(engine).get_analysis(
            sample_set_id,
            after_output_id=cursor,
            limit=limit,
        )
    )
    logger.info(
        "Loaded sample-set analysis chunk "
        "(sample_set_id=%s, cursor=%s, transcriptions=%s, "
        "disagreements=%s, has_more=%s)",
        sample_set_id,
        cursor,
        len(data.transcriptions),
        len(data.disagreements),
        data.has_more,
    )
    return ApiResponse(message="Sample-set analysis chunk retrieved.", data=data)


@router.get(
    "/api/v2/analysis/transcriptions/{output_id}/payload",
    response_model=ApiResponse[TranscriptionPayload],
)
def get_transcription_payload(
    output_id: int = Path(..., ge=1), engine=Depends(get_engine)
) -> ApiResponse[TranscriptionPayload]:
    payload = AnalysisRepository(engine).get_transcription_payload(output_id)
    if payload is None:
        raise HTTPException(404, "Transcription output not found")
    return ApiResponse(
        message="Transcription payload retrieved.",
        data=TranscriptionPayload.model_validate(payload),
    )


@router.post(
    "/api/v2/analysis/disagreements/find",
    response_model=ApiResponse[WorkflowDisagreementComputation],
)
def find_workflow_disagreements(
    request: FindDisagreementsRequest,
    engine=Depends(get_engine),
) -> ApiResponse[WorkflowDisagreementComputation]:
    try:
        computation = AnalysisRepository(engine).find_workflow_disagreements(
            **request.model_dump()
        )
    except LookupError as error:
        raise HTTPException(404, str(error)) from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    data = WorkflowDisagreementComputation.model_validate(computation)
    logger.info(
        "Computed workflow disagreements "
        "(sample_set_id=%s, source_workflow_id=%s, target_workflow_id=%s, "
        "samples=%s, skipped=%s)",
        request.sample_set_id,
        request.source_workflow_id,
        request.target_workflow_id,
        len(data.samples),
        len(data.skipped_samples),
    )
    return ApiResponse(message="Workflow disagreements computed.", data=data)
