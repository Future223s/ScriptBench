from __future__ import annotations

import asyncio
from threading import Lock
from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel


class JobEventHub:
    def __init__(self) -> None:
        self._connections: dict[WebSocket, tuple[int | None, int | None]] = {}
        self._lock = Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(
        self,
        websocket: WebSocket,
        *,
        workflow_id: int | None = None,
        execution_job_id: int | None = None,
    ) -> None:
        await websocket.accept()
        with self._lock:
            self._connections[websocket] = (workflow_id, execution_job_id)

    async def disconnect(self, websocket: WebSocket) -> None:
        with self._lock:
            self._connections.pop(websocket, None)

    async def broadcast(self, payload: dict[str, Any] | BaseModel) -> None:
        if isinstance(payload, BaseModel):
            payload = payload.model_dump()

        with self._lock:
            connections = list(self._connections.items())

        stale_connections: list[WebSocket] = []
        for websocket, (workflow_id, execution_job_id) in connections:
            rows = payload.get("rows", []) if isinstance(payload, dict) else []
            if (
                workflow_id is not None
                and not any(int(row.get("workflow_id", -1)) == workflow_id for row in rows)
            ):
                continue
            if (
                execution_job_id is not None
                and not any(
                    int(row.get("execution_job_id", -1)) == execution_job_id
                    for row in rows
                )
            ):
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_connections.append(websocket)

        if stale_connections:
            with self._lock:
                for websocket in stale_connections:
                    self._connections.pop(websocket, None)

    def broadcast_threadsafe(self, payload: dict[str, Any] | BaseModel) -> None:
        if self._loop is None or not self._loop.is_running():
            return

        self._loop.call_soon_threadsafe(asyncio.create_task, self.broadcast(payload))
