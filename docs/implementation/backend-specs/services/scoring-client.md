# scoring-client

## Trigger: Service

- Service file: `backend/services/scoring_client.py`
- Service name: `ScoringClient`

## Initialization

- Stores the active `WorkflowConfig`
- Stores `evaluation_run_dir` for CSV and JSON output files
- Stores `data_quality_path` when extra grouping metrics are needed
- Registers available scorers in `self.scorers`
- Current scorer map: `align_and_score` -> `_score_with_align_and_score`

## Integration Map

- Used by offline evaluation and notebook-style scoring flows
- Imports `backend/services/align_and_score.py` for the actual metric calculation
- Does not currently appear in the FastAPI route layer
- Writes result files back to the evaluation run directory

## Methods

- `_score_with_align_and_score(workflow_row, transcription_rows, ground_truth_by_sample_id, job_samples_by_job_id=None)`: calculates per-sample metrics and workflow aggregates
- `_data_quality_aggregation(sample_df, data_quality_aggregations)`: merges external quality labels and computes grouped averages
- `score_outputs(workflow_row, transcription_rows, ground_truth_by_sample_id, job_samples_by_job_id=None, scorer="align_and_score", data_quality_aggregations=None)`: selects a scorer and returns the run payload
- `write_csv(run_results)`: writes per-sample and aggregate CSV files
- `write_json(run_results)`: writes the full run payload to JSON
