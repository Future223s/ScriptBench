"""Default metadata used only to seed the database catalog."""
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GeminiConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    model: str = Field(min_length=1, title="Model")
    temperature: float = Field(default=0.0, ge=0, le=2, title="Temperature")
    max_tokens: int | None = Field(default=None, gt=0, title="Maximum output tokens")


class AnthropicConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    model: str = Field(min_length=1, title="Model")
    max_tokens: int = Field(default=4096, gt=0, title="Maximum output tokens")
    temperature: float | None = Field(default=None, ge=0, le=1, title="Temperature")


def seed_step_executors(connection):
    from backend.database.repositories.step_executors_repository import (
        StepExecutorsRepository,
    )

    # Code-defined seeds overwrite the metadata of implemented executors on every run.
    repository = StepExecutorsRepository(connection.engine)
    for name, label, config, input_schema in [
        ("gemini", "Gemini", GeminiConfig, {
            "type": "object", "required": ["contents"],
            "properties": {"contents": {"type": "array", "minItems": 1, "items": {
                "type": "object", "required": ["parts"], "properties": {
                    "role": {"type": "string"},
                    "parts": {"type": "array", "minItems": 1, "items": {"oneOf": [
                        {"type": "object", "required": ["text"], "properties": {"text": {"type": "string"}}},
                        {"type": "object", "required": ["inline_data"], "properties": {"inline_data": {
                            "type": "object", "required": ["mime_type", "data"], "properties": {
                                "mime_type": {"type": "string"}, "data": {"type": "string"}}}}},
                    ]}},
                }}}},
        }),
        ("anthropic", "Anthropic", AnthropicConfig, {
            "type": "object", "required": ["messages"],
            "properties": {"messages": {"type": "array", "minItems": 1, "items": {
                "type": "object", "required": ["role", "content"], "properties": {
                    "role": {"enum": ["user", "assistant"]},
                    "content": {"anyOf": [{"type": "string"}, {"type": "array", "minItems": 1, "items": {
                        "type": "object", "required": ["type"], "properties": {"type": {"type": "string"}},
                    }}]},
                }}}},
        }),
    ]:
        schema = config.model_json_schema()
        schema["properties"]["model"]["pattern"] = r"\S"
        values = dict(
            name=label, description=f"Execute {label} model requests.",
            config_schema=schema,
            methods=[{"name": "transcribe", "label": "Transcribe", "description": "Generate text from the resolved payload."}],
            input_schema={"transcribe": input_schema},
            output_schema={"transcribe": {"type": "string"}}, active=True,
        )
        repository.upsert(name, values, conn=connection)
