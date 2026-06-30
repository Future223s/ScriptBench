# Migration Plan: Sample Sets as Workflow Backbone

This plan captures the move from workflow-centric sample membership to sample-set-centric workflows.
It also normalizes the v1 endpoint shape and adds the event-driven update model.

## Core Direction

- `sample_sets` becomes the primary workflow backbone
- Workflows point to one sample set through `workflows.sample_set_id`
- `workflow_samples` is retired after migration
- Transcription and workflow metrics are stored in dedicated metric fields/tables
- Long-running work persists state changes to the database first, then emits websocket events to the frontend

## Data Model

### Create `sample_sets`

- Store sample-set metadata here
- Recommended structure:
  - `sample_set_id`
  - `sample_set_name`
  - `sample_set_type` or similar classifier if needed
  - timestamps
  - optional descriptive fields for dashboard cards

### Store sample membership in a junction table

- Use a relational membership table rather than JSON
- Recommended structure:
  - `sample_set_samples.sample_set_id`
  - `sample_set_samples.sample_id`
  - `sample_set_samples.position`
  - timestamps
- Why this is the recommended shape:
  - preserves order
  - supports FK constraints
  - keeps analytics joins simple
  - avoids JSON parsing for core workflow reads

### Update `workflows`

- Add `sample_set_id` to correlate each workflow with one sample set
- Keep workflow identity and execution state on the workflow row

### Add `workflow_metrics`

- Store workflow-level metrics such as `cer`, `wer`, `hallucinations`, and related aggregates
- Add a uniqueness constraint on `workflow_id`
- Add a foreign key constraint to `workflows`
- Use this table as the workflow summary record

### Update `transcriptions`

- Ensure transcription rows contain metric fields for:
  - `cer`
  - `wer`
  - `hallucinations`
  - other scoring fields used by the analysis flow
- If future flexibility is needed, keep a JSON metrics column in addition to explicit metric columns

### Retire `workflow_samples`

- Remove `workflow_samples` after callers are migrated to `sample_sets` and `sample_set_samples`
- Backfill existing workflow memberships into the new membership table before removal

## Endpoint Shape

### Common

- `GET /api/v1/sample-sets`
- Used by Dashboard and File Management for display
- Returns top-level `sample_sets` fields suitable for sample-set cards

### Dashboard Page

- `GET /api/v1/sample-sets`
- `GET /api/v1/sample-sets/{sampleSetId}/analytics`

### File Management

- `POST /api/v1/samples`
- `GET /api/v1/samples`
- `GET /api/v1/samples/{sampleId}`
- `DELETE /api/v1/samples/{sampleId}`
- `POST /api/v1/groupings`
- `GET /api/v1/groupings`
- `POST /api/v1/groupings/{groupName}/values`
- `DELETE /api/v1/groupings/{groupingId}`
- `POST /api/v1/sample-sets`
- `GET /api/v1/sample-sets`
- `DELETE /api/v1/sample-sets/{sampleSetId}`

### Workflow Workspace

- `POST /api/v1/workflows`
- `GET /api/v1/workflows`
- `DELETE /api/v1/workflows/{workflowId}`
- `GET /api/v1/workflows/{workflowId}/workspace`
- `POST /api/v1/workflows/{workflowId}/workspace/jobs`
- `PATCH /api/v1/workflows/{workflowId}/workspace/jobs/queue`
- `PATCH /api/v1/workflows/{workflowId}/workspace/jobs/retry`
- `GET /api/v1/workflows/{workflowId}/workspace/jobs/{jobId}`
- `POST /api/v1/workflows/{workflowId}/workspace/transcriptions`
- `GET /api/v1/workflows/{workflowId}/workspace/transcriptions/{transcriptionId}`
- `POST /api/v1/workflows/{workflowId}/workspace/score`

## Workspace Behavior

### `GET /api/v1/workflows/{workflowId}/workspace`

- Return everything the workspace needs to render the workflow state
- Include:
  - workflow row
  - pending jobs
  - queued jobs
  - completed jobs
  - transcriptions

### `PATCH /api/v1/workflows/{workflowId}/workspace/jobs/queue`

- Change job status to `queued`
- Accept job IDs in the payload
- If job IDs are omitted, queue all jobs
- Persist the status changes in the database first
- Emit websocket updates after the database commit

### `PATCH /api/v1/workflows/{workflowId}/workspace/jobs/retry`

- Change job status to `pending`
- Accept job IDs in the payload
- If job IDs are omitted, retry all jobs
- Persist the status changes in the database first
- Emit websocket updates after the database commit

### `GET /api/v1/workflows/{workflowId}/workspace/jobs/{jobId}`

- Return the database row for one job
- Supports job detail views

### `POST /api/v1/workflows/{workflowId}/workspace/transcriptions`

- Create transcription objects from job fields
- Plain text job output:
  - one transcription per job
- JSON array job output:
  - one transcription per array entry if no grouping is specified
  - one transcription per grouping value if grouping is specified
  - preserve JSON array ordering when assembling grouped output
- If a specific job fails:
  - do not fail the whole batch
  - replace that job text with `MODEL ERROR FOR {sampleIds}`
- Persist each created transcription to the database first
- Emit websocket updates after the database commit

### `GET /api/v1/workflows/{workflowId}/workspace/transcriptions/{transcriptionId}`

- Return the transcription detail view payload
- Include:
  - model output
  - ground truth
  - metrics, when available

### `POST /api/v1/workflows/{workflowId}/workspace/score`

- Score all transcriptions using the default scoring method already implemented
- Do not expose scoring method selection in this flow
- Return aggregate summary statistics
- Persist workflow-level scoring results to the database first
- Emit websocket updates after the database commit

## Analytics Behavior

### `GET /api/v1/sample-sets/{sampleSetId}/analytics`

- Collect all workflow rows linked to the sample set
- Collect corresponding metric rows
- Compute summary statistics for each metric:
  - worst performing workflow
  - best performing workflow
  - mean
  - standard deviation
- Return summary data for dashboard analysis

## Event-Driven Pattern

- Long-running asynchronous tasks use websocket updates
- Frontend subscribes to backend updates for transcription completion and related state changes
- The backend remains authoritative
- Rule of execution:
  - write the state change to the database first
  - commit the transaction
  - publish the websocket event
  - let the frontend refetch the affected resource when needed
- This keeps the UI live without making websocket delivery the source of truth
- If a websocket event is missed, the next fetch still reconstructs the correct state

### Recommended Events

- `job.queued`
- `job.pending`
- `job.running`
- `job.completed`
- `job.failed`
- `transcription.created`
- `workflow.scored`
- `sample_set.updated`

## Migration Order

1. Add `sample_sets`
2. Add the sample-set membership junction table
3. Add `workflows.sample_set_id`
4. Backfill workflow membership into sample sets
5. Add `workflow_metrics`
6. Add transcription metric columns
7. Move workspace and analytics reads to the new model
8. Add websocket emission after DB commits for long-running tasks
9. Remove `workflow_samples` after all callers are migrated

## Notes

- Keep the change conservative and phased
- Favor backward-compatible reads during migration
- Record a separate ADR if the sample-set model becomes a durable repo-wide rule
