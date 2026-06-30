# transcription-jobs

## Trigger: Endpoint

- API file: `backend/api/routes/transcription_jobs.py`

## Endpoints

- `GET /api/transcription-jobs/{job_id}`
- `PATCH /api/transcription-jobs/{job_id}`

## Caller

- Workspace and job detail screens
- Job retry or status update flows

## Workflow

### `GET /api/transcription-jobs/{job_id}`

- Load `TranscriptionJobsRepository` and `TranscriptionJobSamplesRepository`
- Fetch the job row
- Return `404` if the job is missing
- Add the ordered sample-id list for that job
- Return the full job payload

### `PATCH /api/transcription-jobs/{job_id}`

- Load `TranscriptionJobsRepository` and `TranscriptionJobSamplesRepository`
- Fetch the existing job
- Return `404` if it does not exist
- Collect only the fields that were actually sent
- Apply the update
- Reload the job
- Return `500` if the refresh fails
- Return the refreshed job payload with sample IDs
