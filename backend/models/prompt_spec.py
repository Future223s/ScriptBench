from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PromptSpecExample(BaseModel):
    title: str
    instruction_text: str
    assets: list[str]

    model_config = ConfigDict(extra="forbid")


class PromptSpecInputs(BaseModel):
    sample_ids: list[str]
    selection_mode: Literal["single", "batch"] = "batch"
    batch_size: int = Field(default=5, ge=1)

    model_config = ConfigDict(extra="forbid")


class PromptSpecOutputFormat(BaseModel):
    type: str
    item_schema: dict[str, str] | None = None

    model_config = ConfigDict(extra="forbid")


class PromptSpec(BaseModel):
    instructions: str
    examples: list[PromptSpecExample]
    inputs: PromptSpecInputs
    output_format: PromptSpecOutputFormat

    model_config = ConfigDict(extra="forbid")
