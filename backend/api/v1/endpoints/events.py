from __future__ import annotations

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.job_events import JobEventHub

router = APIRouter(tags=["events"])

@router.websocket("/api/v1/events")
async def workspace_events(websocket: WebSocket) -> None:
    hub = getattr(websocket.app.state, "job_event_hub", None)
    if not isinstance(hub, JobEventHub):
        hub = JobEventHub()
        websocket.app.state.job_event_hub = hub
    hub.bind_loop(asyncio.get_running_loop())

    await hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(websocket)
