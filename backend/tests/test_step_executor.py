from backend.services.dev_settings import DevSettings
import asyncio
import unittest
from unittest.mock import AsyncMock

from google.genai import errors

from backend.services.clients.gemini_client import GeminiClient
from backend.services.clients.stub_client import StubModelClient
from backend.services.step_executor import StepError, StepExecutionError


class StepExecutorTests(unittest.TestCase):
    def setUp(self):
        import backend.api.dependencies
        from sqlalchemy import create_engine
        from backend.database.schema import metadata
        from backend.services.step_executor_catalog import seed_step_executors
        self.engine = create_engine("sqlite://")
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            seed_step_executors(conn)
        self.addCleanup(self.engine.dispose)

    def test_passes_payload_and_preserves_result(self):
        executor = StubModelClient(model="test")
        payload = {"contents": []}
        result = {"derivative": "image.png"}
        operation = AsyncMock(return_value=result)
        self.assertIs(result, asyncio.run(executor.execute(operation, payload)))
        operation.assert_awaited_once_with(payload=payload)

    def test_existing_error_is_preserved(self):
        executor = StubModelClient(model="test")
        exc = StepExecutionError(StepError(message="Failed", code="test"))
        with self.assertRaises(StepExecutionError) as caught:
            asyncio.run(executor.execute(AsyncMock(side_effect=exc), {}))
        self.assertIs(exc, caught.exception)

    def test_unexpected_error_is_preserved(self):
        executor = StubModelClient(model="test")
        exc = TypeError("Programming error")
        with self.assertRaises(TypeError) as caught:
            asyncio.run(executor.execute(AsyncMock(side_effect=exc), {}))
        self.assertIs(exc, caught.exception)

    def test_gemini_errors_are_translated_with_cause(self):
        executor = GeminiClient(model="test", api_key="test")
        for status, code, retryable in [
            (400, "invalid_input", False),
            (401, "authentication_required", False),
            (429, "rate_limited", True),
            (503, "provider_error", True),
        ]:
            with self.subTest(status=status):
                exc = errors.APIError(status, {"error": {"message": "Failed"}})
                with self.assertRaises(StepExecutionError) as caught:
                    asyncio.run(executor.execute(AsyncMock(side_effect=exc), {}))
                self.assertEqual(code, caught.exception.error.code)
                self.assertEqual(retryable, caught.exception.error.retryable)
                self.assertIs(exc, caught.exception.__cause__)

    def test_factory_stub_executes_through_boundary(self):
        from unittest.mock import patch
        from backend.services.step_executor_factory import StepExecutorFactory

        executor = StepExecutorFactory(self.engine, settings=DevSettings(dev=True)).for_step(
            {"step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "test"}}
        )
        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = asyncio.run(executor.execute(executor.transcribe, {}))
        self.assertEqual("Demo transcription output.", result)
        self.assertIn("transcribe", executor.methods)

    def test_factory_stub_failure_flag(self):
        from unittest.mock import patch
        from backend.services.step_executor_factory import StepExecutorFactory

        settings = DevSettings(dev=True)
        settings.update(stub_mode=True, stub_fail=True)
        executor = StepExecutorFactory(self.engine, settings=settings).for_step(
            {"step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "test"}}
        )
        with patch("asyncio.sleep", new_callable=AsyncMock):
            with self.assertRaisesRegex(RuntimeError, "Stub model failure requested"):
                asyncio.run(executor.execute(executor.transcribe, {}))
