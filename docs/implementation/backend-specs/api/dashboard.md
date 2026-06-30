# dashboard

## Trigger: Endpoint

- API file: `backend/api/routes/dashboard.py`

## Endpoint

- `GET /api/dashboard`

## Caller

- Dashboard page when the app first loads
- Any client that needs a workflow summary list

## Workflow

- Load `WorkflowsRepository` and `WorkflowSamplesRepository`
- Fetch all workflows ordered by the repository
- For each workflow, fetch its workflow-stage sample list
- Convert the workflow row into JSON-safe data
- Cap the sample-id preview at five values
- Count the full sample list
- Return workflows plus total workflow count
