# samples

## Trigger: Endpoint

- API file: `backend/api/routes/samples.py`

## Endpoints

- `GET /api/samples`
- `GET /api/samples/{sample_id}`
- `DELETE /api/samples/{sample_id}`
- `POST /api/samples`

## Caller

- Sample browser screens
- Sample detail views
- Upload and delete actions in the sample management flow

## Workflow

### `GET /api/samples`

- Load `SamplesRepository`
- List samples, optionally filtered by `sample_group`
- Apply in-memory text filtering when `query` is present
- Apply `limit` if requested
- Remove binary blobs from the payload
- Add blob presence and blob size metadata
- Return the sample list and count

### `GET /api/samples/{sample_id}`

- Load `SamplesRepository`
- Fetch one sample row
- Return `404` if the sample is missing
- Remove the raw blob from the JSON payload
- Add blob presence, size, and base64 data
- Return the sample payload

### `DELETE /api/samples/{sample_id}`

- Load `SamplesRepository`
- Verify that the sample exists
- Delete the sample
- Return the deleted flag and sample ID

### `POST /api/samples`

- Read the uploaded file bytes
- Capture the uploaded MIME type
- Upsert the sample row
- Reload the sample row
- Return `500` if the row cannot be reloaded
- Return the stored payload with blob metadata
