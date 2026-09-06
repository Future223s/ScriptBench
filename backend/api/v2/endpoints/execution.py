from __future__ import annotations
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path as FastAPIPath,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from backend.api.dependencies import get_engine
from backend.database.repositories.execution_jobs_repository import (
    ExecutionJobsRepository,
)
from backend.database.repositories.sample_set_samples_repository import (
    SampleSetSamplesRepository,
)
from backend.database.repositories.workflows_repository import WorkflowsRepository
from backend.models.api import ApiListResponse, ApiResponse
from backend.models.execution import (
    ExecutionControlRequest,
    ExecutionControlResponse,
    ExecutionJobRecord,
    FailureAcknowledgementRequest,
)

router = APIRouter(tags=["execution-v2"])


@router.websocket("/api/v2/workflows/{workflow_id}/execution-jobs/events")
async def execution_events(
    websocket: WebSocket,
    workflow_id: int = FastAPIPath(..., ge=1),
    execution_job_id: int | None = Query(None, ge=1),
):
    hub = getattr(websocket.app.state, "job_events", None)
    if hub is None:
        await websocket.close(code=1011)
        return
    await hub.connect(
        websocket, workflow_id=workflow_id, execution_job_id=execution_job_id
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(websocket)


def _ensure_jobs(engine, workflow_id):
    repository = ExecutionJobsRepository(engine)
    workflow = WorkflowsRepository(engine).fetch(workflow_id)
    if workflow is None:
        raise HTTPException(404, "Workflow not found")
    if workflow["status"] == "finalized" and workflow["sample_set_id"] is not None:
        repository.create_jobs(
            workflow_id=workflow_id,
            sample_ids=[
                str(x["sample_id"])
                for x in SampleSetSamplesRepository(engine).list_for_sample_set(
                    int(workflow["sample_set_id"])
                )
            ],
        )


@router.get(
    "/api/v2/workflows/{workflow_id}/execution-jobs",
    response_model=ApiListResponse[ExecutionJobRecord],
)
def list_execution_jobs(
    workflow_id: int = FastAPIPath(..., ge=1), engine=Depends(get_engine)
):
    _ensure_jobs(engine, workflow_id)
    repository = ExecutionJobsRepository(engine)
    items = [
        ExecutionJobRecord.model_validate(x)
        for x in repository.list_for_workflow(workflow_id)
    ]
    return ApiListResponse(
        message="Execution jobs retrieved.", items=items, count=len(items)
    )


@router.get("/api/v2/workflows/{workflow_id}/execution-jobs/{execution_job_id}")
def get_execution_job(
    workflow_id: int, execution_job_id: int, engine=Depends(get_engine)
):
    repository = ExecutionJobsRepository(engine)
    detail = repository.fetch_detail(workflow_id, execution_job_id)
    if detail is None:
        raise HTTPException(404, "Execution job not found")
    return ApiResponse(message="Execution job retrieved.", data=detail)


@router.post(
    "/api/v2/workflows/{workflow_id}/execution-jobs/queue",
    response_model=ExecutionControlResponse,
)
def queue_execution_jobs(
    payload: ExecutionControlRequest, workflow_id: int, engine=Depends(get_engine)
):
    _ensure_jobs(engine, workflow_id)
    repository = ExecutionJobsRepository(engine)
    count = repository.queue(workflow_id, payload.execution_job_ids)
    return ExecutionControlResponse(
        message="Execution jobs queued.",
        data={"workflow_id": workflow_id, "queued_count": count},
    )


@router.post(
    "/api/v2/workflows/{workflow_id}/execution-jobs/dequeue",
    response_model=ExecutionControlResponse,
)
def dequeue_execution_jobs(
    payload: ExecutionControlRequest, workflow_id: int, engine=Depends(get_engine)
):
    _ensure_jobs(engine, workflow_id)
    repository = ExecutionJobsRepository(engine)
    count = repository.dequeue(workflow_id, payload.execution_job_ids)
    return ExecutionControlResponse(
        message="Execution jobs dequeued.",
        data={"workflow_id": workflow_id, "dequeued_count": count},
    )


@router.post(
    "/api/v2/workflows/{workflow_id}/execution-jobs/retry",
    response_model=ExecutionControlResponse,
)
def retry_completed_execution_jobs(
    payload: ExecutionControlRequest,
    workflow_id: int,
    request: Request,
    engine=Depends(get_engine),
):
    _ensure_jobs(engine, workflow_id)
    _worker(request).stop(workflow_id)
    repository = ExecutionJobsRepository(engine)
    count = repository.retry_completed(workflow_id, payload.execution_job_ids)
    return ExecutionControlResponse(
        message="Completed execution jobs requeued.",
        data={"workflow_id": workflow_id, "queued_count": count},
    )


def _worker(request):
    worker = getattr(request.app.state, "execution_worker", None)
    if worker is None:
        raise HTTPException(503, "Execution worker is not configured")
    return worker


@router.post(
    "/api/v2/workflows/{workflow_id}/execute", response_model=ExecutionControlResponse
)
async def start_execution(
    request: Request, workflow_id: int, engine=Depends(get_engine)
):
    _ensure_jobs(engine, workflow_id)
    worker = _worker(request)
    worker.start(workflow_id)
    worker.wake()
    return ExecutionControlResponse(
        message="Execution started.",
        data={"workflow_id": workflow_id, "active_jobs": worker.active_jobs},
    )


@router.post(
    "/api/v2/workflows/{workflow_id}/execution-jobs/{execution_job_id}/failure-acknowledgement",
    response_model=ExecutionControlResponse,
)
async def acknowledge_execution_job_failure(
    request: Request,
    payload: FailureAcknowledgementRequest,
    workflow_id: int,
    execution_job_id: int,
    engine=Depends(get_engine),
):
    repository = ExecutionJobsRepository(engine)
    if repository.fetch_for_workflow(workflow_id, execution_job_id) is None:
        raise HTTPException(404, "Execution job not found")
    repository.acknowledge_failure(workflow_id, execution_job_id, payload.action)
    worker = _worker(request)
    if payload.action == "retry":
        worker.start(workflow_id)
        worker.wake()
    else:
        worker.stop(workflow_id)
    return ExecutionControlResponse(
        message=f"Failure acknowledged: {payload.action}.",
        data={
            "workflow_id": workflow_id,
            "execution_job_id": execution_job_id,
            "action": payload.action,
        },
    )


@router.post("/api/v2/workflows/{workflow_id}/stop")
async def stop_execution(
    request: Request, workflow_id: int, engine=Depends(get_engine)
):
    _ensure_jobs(engine, workflow_id)
    worker = _worker(request)
    worker.stop(workflow_id)
    return ApiResponse(
        message="Execution stopping.",
        data={"workflow_id": workflow_id, "active_jobs": worker.active_jobs},
    )
