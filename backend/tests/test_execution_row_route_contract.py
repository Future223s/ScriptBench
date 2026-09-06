from __future__ import annotations

import inspect
import unittest
from pathlib import Path

from backend.api.main import app
from backend.api.v2.endpoints.execution import (
    acknowledge_execution_row_failure,
    acknowledge_execution_failure,
    retry_execution,
    start_execution,
    stop_execution,
)


class ExecutionRowRouteContractTests(unittest.TestCase):
    def test_frontend_uses_only_workflow_scoped_execution_row_routes(self) -> None:
        source = (
            Path(__file__).resolve().parents[2]
            / "frontend"
            / "src"
            / "api"
            / "endpoints"
            / "workspace.ts"
        ).read_text(encoding="utf-8")
        hook_source = (
            Path(__file__).resolve().parents[2]
            / "frontend"
            / "src"
            / "hooks"
            / "workspace"
            / "useWorkspacePage.js"
        ).read_text(encoding="utf-8")

        self.assertNotIn("workflows/workspaces/execution_rows", source)
        self.assertNotIn("workflow_id: workflowId", source)
        self.assertIn(
            "JSON.stringify({ execution_row_ids: executionRowIds })",
            source,
        )
        self.assertIn("job.error_message", hook_source)
        self.assertIn("next.workspaceError", hook_source)
        self.assertIn("Execution row ${rowId} failed", hook_source)
        self.assertIn("retryFailure", hook_source)
        self.assertIn("skipFailure", hook_source)
        self.assertIn("stopFailureExecution", hook_source)
        self.assertIn("queued_count", hook_source)
        self.assertIn("workspaceNotice", hook_source)
        self.assertIn("applyRows(rows, { loadingWorkspace: false })", hook_source)
        self.assertIn("refreshUntilSettled", hook_source)
        self.assertIn("acknowledgedFailureRowIds", hook_source)
        self.assertIn("NEXT_PUBLIC_API_WS_BASE_URL", source)
        for suffix in (
            "/execution-rows`",
            "/execution-rows/queue`",
            "/execution-rows/dequeue`",
            "/execution-rows/${encodeURIComponent(String(rowId))}`",
            "/execution-rows/events${rowQuery}`",
        ):
            self.assertIn(suffix, source)

    def test_workspace_detail_selects_an_output_after_detail_data_arrives(self) -> None:
        source = (
            Path(__file__).resolve().parents[2]
            / "frontend"
            / "src"
            / "components"
            / "workspace"
            / "WorkspaceOverlays.js"
        ).read_text(encoding="utf-8")

        self.assertIn("const defaultStepId", source)
        self.assertIn("const selectedStepOutput", source)
        self.assertIn("const displayedOutput", source)
        self.assertIn("[defaultStepId, row?.execution_row_id, workflowSteps]", source)
        self.assertIn("typeof selectedOutput.parsed_output === \"string\"", source)

    def test_backend_registers_frontend_execution_row_routes(self) -> None:
        registered = {
            (route.path, method)
            for route in app.routes
            for method in (getattr(route, "methods", None) or set())
        }
        base = "/api/v2/workflows/{workflow_id}/execution-rows"
        self.assertIn((base, "GET"), registered)
        self.assertIn((f"{base}/{{execution_row_id}}", "GET"), registered)
        self.assertIn((f"{base}/queue", "POST"), registered)
        self.assertIn((f"{base}/dequeue", "POST"), registered)
        self.assertIn(
            (f"{base}/{{execution_row_id}}/failure-acknowledgement", "POST"),
            registered,
        )

    def test_worker_lifecycle_routes_run_on_application_event_loop(self) -> None:
        for handler in (
            start_execution,
            stop_execution,
            retry_execution,
            acknowledge_execution_failure,
            acknowledge_execution_row_failure,
        ):
            self.assertTrue(
                inspect.iscoroutinefunction(handler),
                f"{handler.__name__} must not run in FastAPI's threadpool",
            )


if __name__ == "__main__":
    unittest.main()
