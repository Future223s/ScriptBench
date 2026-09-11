from backend.services.dev_settings import DevSettings
import asyncio
import unittest
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.pool import StaticPool

import backend.api.dependencies
from backend.api.dependencies import get_engine
from backend.api.v2.endpoints.workflow_steps import router
from backend.database.schema import metadata
from backend.database.tables.step_executors_table import step_executors
from backend.database.repositories.step_executors_repository import StepExecutorsRepository
from backend.services.step_executor_catalog import seed_step_executors
from backend.services.executor_validation import validate_config
from backend.services.step_executor_factory import StepExecutorFactory
from backend.services.step_executor import StepExecutionError


class ExecutorCatalogTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            seed_step_executors(conn)
        self.addCleanup(self.engine.dispose)
        self.repository = StepExecutorsRepository(self.engine)

    def test_list_is_summary_and_get_has_full_metadata(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_engine] = lambda: self.engine
        with TestClient(app) as client:
            response = client.get("/api/v2/step-executors")
            self.assertEqual(200, response.status_code)
            self.assertEqual({"id", "name", "description"}, set(response.json()["items"][0]))
            detail = client.get("/api/v2/step-executors/gemini")
            self.assertEqual(200, detail.status_code)
            data = detail.json()["data"]
            self.assertEqual({"id", "name", "description", "config_schema", "methods", "input_schema", "output_schema", "active", "created_at", "updated_at"}, set(data))
            self.assertEqual(["transcribe"], [item["name"] for item in data["methods"]])
            self.assertEqual(404, client.get("/api/v2/step-executors/missing").status_code)
            with self.engine.begin() as conn:
                conn.execute(update(step_executors).where(step_executors.c.id == "gemini").values(active=False))
            self.assertEqual(404, client.get("/api/v2/step-executors/gemini").status_code)
            self.assertEqual(["anthropic"], [item["id"] for item in client.get("/api/v2/step-executors").json()["items"]])
        with self.assertRaises(ValueError):
            validate_config(self.repository.fetch("gemini"), {"model": "test"}, "transcribe")

    def test_database_schema_is_authoritative_until_seed_overwrites_metadata(self):
        definition = dict(self.repository.fetch("gemini"))
        schema = definition["config_schema"]
        schema["properties"]["temperature"]["maximum"] = 0.25
        with self.engine.begin() as conn:
            conn.execute(update(step_executors).where(step_executors.c.id == "gemini").values(config_schema=schema))
        with self.assertRaises(ValueError):
            StepExecutorFactory(self.engine, settings=DevSettings(dev=True)).for_step({"step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "test", "temperature": 0.5}})
        with self.assertRaises(ValueError):
            validate_config(self.repository.fetch("gemini"), {"model": "test"}, "__init__")
        with self.engine.begin() as conn:
            seed_step_executors(conn)
            self.assertEqual(2, len(conn.execute(select(step_executors)).all()))
        config = validate_config(self.repository.fetch("gemini"), {"model": "test", "temperature": 0.5}, "transcribe")
        self.assertEqual(0.5, config["temperature"])

    def test_reseed_overwrites_all_metadata_preserving_identity_and_creation_time(self):
        from datetime import datetime
        original = dict(self.repository.fetch("gemini"))
        with self.engine.begin() as conn:
            conn.execute(update(step_executors).where(step_executors.c.id == "gemini").values(
                name="Edited", description="Edited", config_schema={}, methods=[],
                input_schema={}, output_schema={}, active=False,
                updated_at=datetime(2000, 1, 1),
            ))
            seed_step_executors(conn)
        restored = dict(self.repository.fetch("gemini"))
        for key in original.keys() - {"updated_at"}:
            self.assertEqual(original[key], restored[key], key)
        self.assertGreater(restored["updated_at"], datetime(2000, 1, 1))

    def test_documented_executor_records_match_seed(self):
        import json
        from pathlib import Path
        documented = json.loads((Path(__file__).resolve().parents[2] / "docs" / "seeded-step-executors.json").read_text())
        actual = [{key: value for key, value in self.repository.fetch(name).items()
                   if key not in {"created_at", "updated_at"}} for name in ["gemini", "anthropic"]]
        self.assertEqual(documented, actual)


    def test_internal_input_and_output_schemas_are_enforced(self):
        executor = StepExecutorFactory(self.engine, settings=DevSettings(dev=True)).for_step({
            "step_executor_id": "gemini", "method": "transcribe", "executor_config": {"model": "test"}})
        operation = AsyncMock(return_value="text")
        executor.operations["transcribe"] = operation
        with self.assertRaises(StepExecutionError) as caught:
            asyncio.run(executor.execute_method("transcribe", {"messages": []}))
        self.assertEqual("invalid_input", caught.exception.error.code)
        operation.assert_not_awaited()
        payload = {"contents": [{"parts": [{"inline_data": {"mime_type": "image/png", "data": b"image"}}]}]}
        self.assertEqual("text", asyncio.run(executor.execute_method("transcribe", payload)))
        operation.return_value = {"unexpected": "object"}
        with self.assertRaises(StepExecutionError) as caught:
            asyncio.run(executor.execute_method("transcribe", payload))
        self.assertEqual("invalid_output", caught.exception.error.code)
        with self.assertRaises(StepExecutionError) as caught:
            asyncio.run(executor.execute_method("__init__", payload))
        self.assertEqual("invalid_method", caught.exception.error.code)
