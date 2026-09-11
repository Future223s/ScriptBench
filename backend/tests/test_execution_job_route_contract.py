from __future__ import annotations

import inspect
import unittest
from pathlib import Path

from backend.api.main import app
from backend.api.v2.endpoints.execution import (
    acknowledge_execution_job_failure, start_execution, stop_execution,
)


class ExecutionJobRouteContractTests(unittest.TestCase):
    def test_frontend_uses_workflow_scoped_job_routes_and_canonical_ids(self):
        source = (Path(__file__).resolve().parents[2] / 'frontend/src/api/endpoints/workspace.ts').read_text()
        self.assertNotIn('/execution-rows', source)
        self.assertIn('JSON.stringify({ ids: ids })', source)
        for suffix in ('/execution-jobs', '/execution-jobs/queue', '/execution-jobs/dequeue',
                       '/execution-jobs/retry', '/failure-acknowledgement'):
            self.assertIn(suffix, source)

    def test_backend_registers_execution_job_routes(self):
        registered = {(path, method.upper()) for path, operations in app.openapi()['paths'].items()
                      for method in operations}
        base = '/api/v2/workflows/{workflow_id}/execution-jobs'
        for suffix, method in [('', 'GET'), ('/{execution_job_id}', 'GET'),
                               ('/queue', 'POST'), ('/dequeue', 'POST'), ('/retry', 'POST'),
                               ('/{execution_job_id}/failure-acknowledgement', 'POST')]:
            self.assertIn((base + suffix, method), registered)
        self.assertFalse(any('/execution-rows' in path for path, _ in registered))

    def test_worker_lifecycle_runs_on_application_event_loop(self):
        for handler in (start_execution, stop_execution, acknowledge_execution_job_failure):
            self.assertTrue(inspect.iscoroutinefunction(handler), handler.__name__)
