import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

import backend.api.dependencies
from backend.api.v2.endpoints.dev_settings import router
from backend.database.schema import metadata
from backend.services.dev_settings import DevSettings
from backend.services.step_executor_factory import StepExecutorFactory
from backend.services.step_executor_catalog import seed_step_executors
from backend.services.clients.stub_client import StubModelClient


class DevSettingsTests(unittest.TestCase):
    def client(self, settings):
        app = FastAPI()
        app.state.dev_settings = settings
        app.include_router(router)
        client = TestClient(app)
        self.addCleanup(client.close)
        return client

    def test_non_dev_disables_controls_and_rejects_changes(self):
        settings = DevSettings(dev=False)
        client = self.client(settings)
        self.assertEqual({"dev": False, "stub_mode": False, "stub_fail": False}, client.get("/api/v2/dev-settings").json())
        self.assertEqual(404, client.patch("/api/v2/dev-settings", json={"stub_mode": True, "stub_fail": True}).status_code)
        self.assertFalse(settings.snapshot()["stub_mode"])

    def test_defaults_reset_and_strict_update_validation(self):
        with patch.dict("os.environ", {"DEV": "true"}):
            settings = DevSettings.from_environment()
        client = self.client(settings)
        self.assertEqual({"dev": True, "stub_mode": True, "stub_fail": False}, settings.snapshot())
        for body in [{"stub_mode": "false", "stub_fail": False}, {"stub_mode": False}, {"stub_mode": False, "stub_fail": False, "dev": True}]:
            self.assertEqual(422, client.patch("/api/v2/dev-settings", json=body).status_code)
        self.assertEqual(200, client.patch("/api/v2/dev-settings", json={"stub_mode": True, "stub_fail": True}).status_code)
        self.assertTrue(client.get("/api/v2/dev-settings").json()["stub_fail"])
        self.assertFalse(DevSettings(dev=True).snapshot()["stub_fail"])

    def test_updates_affect_next_executor_but_not_existing_executor(self):
        engine = create_engine("sqlite://")
        self.addCleanup(engine.dispose)
        metadata.create_all(engine)
        with engine.begin() as conn:
            seed_step_executors(conn)
        settings = DevSettings(dev=True)
        client = self.client(settings)
        factory = StepExecutorFactory(engine, settings=settings)
        step = {"step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "test"}}
        original = factory.for_step(step)
        self.assertIsInstance(original, StubModelClient)
        self.assertFalse(original.fail)
        client.patch("/api/v2/dev-settings", json={"stub_mode": True, "stub_fail": True})
        self.assertTrue(factory.for_step(step).fail)
        self.assertFalse(original.fail)
        client.patch("/api/v2/dev-settings", json={"stub_mode": False, "stub_fail": True})
        with patch("backend.services.step_executor_factory.GeminiClient") as real:
            self.assertIs(factory.for_step(step), real.return_value)
            real.assert_called_once_with(model="test", temperature=0.0)
        client.patch("/api/v2/dev-settings", json={"stub_mode": True, "stub_fail": False})
        self.assertFalse(factory.for_step(step).fail)
