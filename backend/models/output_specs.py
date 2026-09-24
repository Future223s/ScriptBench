from __future__ import annotations

from datetime import datetime

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .api import ApiResponse


class OutputSpecRecord(BaseModel):
    id: int
    name: str
    item_schema: dict[str, Any]
    instructions: str | None = None
    status: str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")


class OutputSpecCreateRequest(BaseModel):
    name: str
    item_schema: dict[str, Any] = Field(default_factory=lambda: {"type": "string"})
    instructions: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("item_schema")
    @classmethod
    def validate_item_schema(cls, value: dict[str, Any]) -> dict[str, Any]:
        item_type = value.get("type")
        if item_type not in {"string", "object"}:
            raise ValueError("item_schema.type must be string or object")
        if item_type == "object":
            properties = value.get("properties")
            if not isinstance(properties, dict):
                raise ValueError("Object item shapes require properties")
            for name, definition in properties.items():
                if not str(name).strip() or not isinstance(definition, dict):
                    raise ValueError("Each property requires a name and shape")
                if definition.get("type") not in {"string", "number", "boolean"}:
                    raise ValueError("Property type must be string, number, or boolean")
                if not isinstance(definition.get("required", False), bool):
                    raise ValueError("Property required must be true or false")
        return value


class OutputSpecDeleteRequest(BaseModel):
    ids: list[int]

    model_config = ConfigDict(extra="forbid")


class OutputSpecCreateResponse(ApiResponse[OutputSpecRecord]):
    pass
