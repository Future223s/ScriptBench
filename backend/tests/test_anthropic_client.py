import asyncio
import unittest
from unittest.mock import AsyncMock

from anthropic import AuthenticationError, NotFoundError, RateLimitError, InternalServerError
import httpx

from backend.services.clients.anthropic_client import AnthropicClient
from backend.services.step_executor import StepExecutionError


class AnthropicErrorTests(unittest.TestCase):
    def test_known_errors_cross_execution_boundary(self):
        executor = object.__new__(AnthropicClient)
        for exception_type, status, code, retryable in [
            (AuthenticationError, 401, "authentication_required", False),
            (NotFoundError, 404, "not_found", False),
            (RateLimitError, 429, "rate_limited", True),
            (InternalServerError, 500, "provider_error", True),
        ]:
            with self.subTest(status=status):
                response = httpx.Response(status, request=httpx.Request("POST", "https://example.com"))
                exc = exception_type("Failed", response=response, body=None)
                with self.assertRaises(StepExecutionError) as caught:
                    asyncio.run(executor.execute(AsyncMock(side_effect=exc), {}))
                self.assertEqual(code, caught.exception.error.code)
                self.assertEqual(retryable, caught.exception.error.retryable)
                self.assertEqual(str(exc), caught.exception.error.message)
                self.assertIs(exc, caught.exception.__cause__)

    def test_unknown_exception_passes_through(self):
        executor = object.__new__(AnthropicClient)
        exc = TypeError("Unexpected")
        with self.assertRaises(TypeError) as caught:
            asyncio.run(executor.execute(AsyncMock(side_effect=exc), {}))
        self.assertIs(exc, caught.exception)
