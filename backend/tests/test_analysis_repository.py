from __future__ import annotations

from datetime import datetime, timezone
import unittest
from unittest.mock import Mock, call

from backend.database.repositories.analysis_repository import AnalysisRepository
from backend.models.analysis import SampleSetAnalysis


def _analysis_row(
    output_id: int,
    workflow_step_id: int,
    workflow_step_name: str,
    text: str,
) -> dict[str, object]:
    timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "id": output_id,
        "workflow_id": 10,
        "workflow_step_id": workflow_step_id,
        "sample_id": "sample-1",
        "attempt_no": 1,
        "raw_model_response": text,
        "parsed_output": text,
        "parse_status": "success",
        "parse_error": None,
        "cer": None,
        "time_elapsed": 1.0,
        "started_at": timestamp,
        "completed_at": timestamp,
        "workflow_step_name": workflow_step_name,
        "workflow_step_executor_config": {"model": "test-model"},
        "workflow_name": "Workflow",
        "sample_set_id": 20,
        "sample_set_name": "Sample set",
        "sample_name": "Sample",
        "sample_mime_type": "image/png",
        "ground_truth_text": None,
    }


class AnalysisRepositoryChunkTests(unittest.TestCase):
    def test_chunks_outputs_and_emits_each_disagreement_with_its_source(self):
        source = _analysis_row(1, 100, "Draft", "abc")
        target = _analysis_row(2, 200, "Review", "axc")
        repository = AnalysisRepository(Mock())
        repository._rows = Mock(side_effect=[[source, target], [target]])
        repository._adjacencies = Mock(return_value=[(10, 100, 200)])
        repository._rows_for_keys = Mock(side_effect=[[target], [source]])

        first = repository.get_analysis(limit=1)
        second = repository.get_analysis(after_output_id=1, limit=1)

        SampleSetAnalysis.model_validate(first)
        SampleSetAnalysis.model_validate(second)
        self.assertEqual([1], [item["id"] for item in first["transcriptions"]])
        self.assertEqual([2], [item["id"] for item in second["transcriptions"]])
        self.assertTrue(first["has_more"])
        self.assertEqual(1, first["next_cursor"])
        self.assertFalse(second["has_more"])
        self.assertIsNone(second["next_cursor"])
        self.assertEqual(1, len(first["disagreements"]))
        self.assertEqual([], second["disagreements"])
        self.assertEqual(
            "downstream",
            first["transcriptions"][0]["relationships"][0]["direction"],
        )
        self.assertEqual(
            "upstream",
            second["transcriptions"][0]["relationships"][0]["direction"],
        )
        self.assertEqual(
            [
                call(
                    None,
                    after_output_id=None,
                    limit=2,
                ),
                call(
                    None,
                    after_output_id=1,
                    limit=2,
                ),
            ],
            repository._rows.call_args_list,
        )


if __name__ == "__main__":
    unittest.main()
