from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health-v0"])


@router.get("/api/v0/health")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
