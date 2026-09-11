from backend.services.dev_settings import DevSettings
import unittest
from unittest.mock import patch
from sqlalchemy import create_engine, inspect
from backend.services.executor_validation import validate_config
from backend.database.repositories.step_executors_repository import StepExecutorsRepository

from backend.models.workflow_steps import WorkflowStepCreateRequest
from backend.services.step_executor_catalog import seed_step_executors
from backend.services.step_executor_factory import StepExecutorFactory


class ExecutorConfigurationTests(unittest.TestCase):
    def setUp(self):
        import backend.api.dependencies
        from backend.database.schema import metadata
        self.engine = create_engine("sqlite://")
        metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            seed_step_executors(conn)
        self.repository = StepExecutorsRepository(self.engine)
        self.addCleanup(self.engine.dispose)

    def request(self, **values):
        return WorkflowStepCreateRequest(name="Read", payload_template_id=1, output_spec_id=1, **values)

    def test_validation_defaults_and_unknown_options(self):
        definition = self.repository.fetch("anthropic")
        config = validate_config(definition, {"model": "test"}, "transcribe")
        self.assertEqual({"model": "test", "max_tokens": 4096}, config)
        for name, config in [("unknown", {}), ("gemini", {"model": " "}),
                             ("anthropic", {"model": "test", "max_tokens": 0}),
                             ("gemini", {"model": "test", "temperature": 3}),
                             ("gemini", {"model": "test", "typo": 1})]:
            with self.subTest(name=name, config=config), self.assertRaises(ValueError):
                validate_config(self.repository.fetch(name), config, "transcribe")

    def test_catalog_requires_no_provider_credentials(self):
        with patch.dict("os.environ", {}, clear=True):
            catalog = self.repository.list()
        self.assertEqual({"gemini", "anthropic"}, {item["id"] for item in catalog})
        self.assertNotIn("config_schema", catalog[0])
        self.assertIn("model", self.repository.fetch("gemini")["config_schema"]["required"])

    def test_factory_passes_configuration_to_adapters(self):
        for name, constructor in [("gemini", "GeminiClient"), ("anthropic", "AnthropicClient")]:
            with patch(f"backend.services.step_executor_factory.{constructor}") as adapter:
                result = StepExecutorFactory(self.engine, settings=DevSettings(dev=False)).for_step({
                    "step_executor_id": name, "method": "transcribe", "executor_config": {"model": "test", "temperature": 0.5, "max_tokens": 100},
                })
                adapter.assert_called_once_with(model="test", temperature=0.5, max_tokens=100)
                self.assertIs(result, adapter.return_value)

    def test_fresh_table_defines_executor_configuration(self):
        import backend.api.dependencies
        from backend.database.schema import metadata
        engine = create_engine("sqlite://")
        metadata.create_all(engine)
        columns = {col["name"]: col for col in inspect(engine).get_columns("workflow_steps")}
        self.assertFalse(columns["step_executor_id"]["nullable"])
        self.assertFalse(columns["executor_config"]["nullable"])
        self.assertNotIn("model", columns)
        self.assertNotIn("model_family", columns)
        engine.dispose()

    def test_create_step_persists_config_and_rejects_incompatible_template(self):
        import backend.api.dependencies
        from fastapi import HTTPException
        from backend.api.v2.endpoints.workflow_steps import create_workflow_step
        from backend.database.schema import metadata
        from backend.database.tables.payload_templates_table import payload_templates
        from backend.database.tables.output_specs_table import output_specs
        engine = self.engine
        with engine.begin() as conn:
            template_id = conn.execute(payload_templates.insert().values(
                name="Test", model_family="gemini", payload={}
            )).inserted_primary_key[0]
            spec_id = conn.execute(output_specs.insert().values(
                name="Text", type="plain-text"
            )).inserted_primary_key[0]
        request = WorkflowStepCreateRequest(name="Read", step_executor_id="gemini", method="transcribe",
            executor_config={"model": "test", "temperature": 0.4, "max_tokens": 25},
            payload_template_id=template_id, output_spec_id=spec_id)
        result = create_workflow_step(request, engine)
        self.assertEqual(request.executor_config, result.data.executor_config)
        self.assertEqual("gemini", result.data.step_executor_id)
        request.step_executor_id = "anthropic"
        with self.assertRaises(HTTPException) as caught:
            create_workflow_step(request, engine)
        self.assertEqual(400, caught.exception.status_code)
        engine.dispose()
