from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

from pydantic import BaseModel, Field

class StepError(BaseModel):
    """Describes a step execution failure."""

    message: str
    code: str
    retryable: bool = False
    retry_after: timedelta | None = Field(
        default=None,
        ge=timedelta(0),
    )


class StepExecutionError(Exception):
    def __init__(self, error: StepError):
        super().__init__(error.message)
        self.error = error


class StepExecutor(ABC):
    """Shared error boundary for executor operations."""

    def __init__(
        self,
        name: str,
        methods: dict[str, Any] | None = None,
    ) -> None:
        self.name = name
        self.methods = methods or {}
        self.definition = None
        self.operations = {}

    async def execute_method(self, method: str, payload: dict[str, Any]) -> Any:
        from backend.services.executor_validation import validate_value

        if self.definition is None or method not in self.operations:
            raise StepExecutionError(StepError(message="Unsupported executor method", code="invalid_method"))
        try:
            validate_value(self.definition["input_schema"][method], payload)
        except ValueError as exc:
            raise StepExecutionError(StepError(message=str(exc), code="invalid_input")) from exc
        result = await self.execute(self.operations[method], payload)
        try:
            validate_value(self.definition["output_schema"][method], result)
        except ValueError as exc:
            raise StepExecutionError(StepError(message=str(exc), code="invalid_output")) from exc
        return result

    async def execute(
        self,
        operation: Callable[..., Awaitable[Any]],
        payload: dict[str, Any],
        **kwargs: Any,
    ) -> Any:
        try:
            return await operation(payload=payload, **kwargs)
        except StepExecutionError:
            raise
        except Exception as exc:
            translated = self.translate_error(exc)
            if translated is None:
                raise
            raise translated from exc

    @abstractmethod
    def translate_error(
        self,
        exc: Exception,
    ) -> StepExecutionError | None:
        """Translate recognized failures; return None otherwise."""