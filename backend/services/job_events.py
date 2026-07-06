from __future__ import annotations

import asyncio
from threading import Lock
from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel


class JobEventHub:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any] | BaseModel) -> None:
        if isinstance(payload, BaseModel):
            payload = payload.model_dump()

        with self._lock:
            connections = list(self._connections)

        stale_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_connections.append(websocket)

        if stale_connections:
            with self._lock:
                for websocket in stale_connections:
                    self._connections.discard(websocket)

    def broadcast_threadsafe(self, payload: dict[str, Any] | BaseModel) -> None:
        if self._loop is None or not self._loop.is_running():
            return

        self._loop.call_soon_threadsafe(asyncio.create_task, self.broadcast(payload))
