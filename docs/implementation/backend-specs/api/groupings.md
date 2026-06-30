# groupings

## Trigger: Endpoint

- API file: `backend/api/routes/groupings.py`

## Endpoints

- `GET /api/groupings`
- `POST /api/groupings`
- `POST /api/groupings/{group_name}/values`
- `DELETE /api/groupings/{group_name}`

## Caller

- Sample grouping UI
- Any workflow builder or organizer flow that edits sample group values

## Workflow

### `GET /api/groupings`

- Load `SamplesRepository`
- Derive groupings from `sample_group` and `sample_groups`
- Return the grouped assignments and total count

### `POST /api/groupings`

- Read and trim the grouping name
- Deduplicate and trim sample IDs
- Assign the samples to the named group
- Fail with `404` if any sample IDs are unknown
- Re-derive groupings
- Return the new or updated grouping payload

### `POST /api/groupings/{group_name}/values`

- Read and trim the group name and value
- Deduplicate and trim sample IDs
- Write the value into `sample_groups[group_name]` for each sample
- Fail with `404` if any sample IDs are unknown
- Re-derive groupings
- Return the updated grouping payload

### `DELETE /api/groupings/{group_name}`

- Trim the requested group name
- Verify that the grouping exists
- Remove the group from both `sample_group` and `sample_groups`
- Return the deleted flag and the number of updated samples
