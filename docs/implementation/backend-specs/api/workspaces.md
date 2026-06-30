# workspaces

## Trigger: Endpoint

- API file: `backend/api/routes/workspaces.py`

## Endpoints

- `GET /api/workspaces/{workflow_id}`
- `POST /api/workspaces/{workflow_id}/opened`
- `POST /api/workspaces/{workflow_id}/jobs`

## Caller

- Workspace view when opening a workflow
- Workspace view when marking a workflow as opened
- Workspace job generation flow

## Workflow

### `GET /api/workspaces/{workflow_id}`

- Load workflow, sample, job, job-sample, and transcription repositories
- Verify the workflow exists for the requested stage
- Load the configured workflow sample IDs
- Load each sample row and keep the original order
- Fetch open and completed jobs for the workflow
- Attach sample IDs to each job
- Split jobs into pending, queued, and completed groups
- Load transcriptions for the workflow
- Return the workflow, samples, jobs, and transcriptions payload

### `POST /api/workspaces/{workflow_id}/opened`

- Load `WorkflowsRepository`
- Verify the workflow exists for the requested stage
- Mark the workflow as opened
- Reload the workflow
- Return `500` if the workflow cannot be refreshed
- Return the updated timestamp payload

### `POST /api/workspaces/{workflow_id}/jobs`

- Forward directly to the shared job-creation helper
- Resolve the workflow row and prompt spec
- Load workflow samples and sample rows
- Batch samples by prompt size
- Group samples when workflow groups exist
- Fetch sample blobs and MIME types
- Build a Gemini client and prompt-resolution service
- Resolve the prompt and store the job row
- Attach sample IDs to the job
- Return the job summary payload
