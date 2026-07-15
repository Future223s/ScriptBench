from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: T | None = None

    model_config = ConfigDict(extra="forbid")


class ApiListResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    items: list[T] = Field(default_factory=list)
    count: int = 0

    model_config = ConfigDict(extra="forbid")


class ApiDeleteResponse(BaseModel):
    success: bool = True
    message: str
    deleted: bool = True

    model_config = ConfigDict(extra="forbid")
