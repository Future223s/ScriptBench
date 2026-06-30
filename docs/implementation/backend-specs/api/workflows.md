# workflows

## Trigger: Endpoint

- API file: `backend/api/routes/workflows.py`

## Endpoints

- `POST /api/workflows`
- `DELETE /api/workflows/{workflow_id}`

## Caller

- Workflow creation UI
- Workflow delete or cleanup flow

## Workflow

### `POST /api/workflows`

- Parse the workflow payload, including `prompt_spec`
- Deduplicate sample IDs
- Verify that every sample ID exists
- Create the workflow row
- If sample IDs were provided, replace the workflow sample mapping
- Reload the workflow
- Return `500` if the workflow cannot be reloaded
- Return the workflow payload plus `sample_ids` and `workflow_groups`

### `DELETE /api/workflows/{workflow_id}`

- Load `WorkflowsRepository`
- Fetch the workflow
- Return `404` if it does not exist
- Delete the workflow and its linked rows
- Return the deleted flag and workflow ID
