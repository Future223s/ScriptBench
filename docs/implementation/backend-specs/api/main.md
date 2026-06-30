# main

## Trigger: Endpoint

- API file: `backend/api/main.py`

## Caller

- Process entrypoint
- Health checks from deployment or local smoke tests

## Workflow

- Build the FastAPI app
- Register the dashboard, groupings, samples, transcription-jobs, workflows, and workspaces routers
- Expose `GET /healthz`
- Return `{"status": "ok"}` for health checks
