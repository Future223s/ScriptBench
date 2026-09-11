from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, StrictBool

router = APIRouter(tags=["development"])


class DevSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stub_mode: StrictBool
    stub_fail: StrictBool


@router.get("/api/v2/dev-settings")
def get_dev_settings(request: Request):
    return request.app.state.dev_settings.snapshot()


@router.patch("/api/v2/dev-settings")
def update_dev_settings(payload: DevSettingsUpdate, request: Request):
    settings = request.app.state.dev_settings
    if not settings.dev:
        raise HTTPException(status_code=404, detail="Not found")
    return settings.update(**payload.model_dump())
