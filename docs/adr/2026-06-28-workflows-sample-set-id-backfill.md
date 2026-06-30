# ADR: Backfill `workflows.sample_set_id` on startup

## Status

Accepted

## Context

The checked-in SQLite database predates the current `workflows.sample_set_id` column. `metadata.create_all()` does not alter an existing table, so any run against that legacy database failed on `/api/dashboard` with `no such column: workflows.sample_set_id`.

## Decision

On engine initialization, the backend now inspects the `workflows` table and adds a nullable `sample_set_id` column if it is missing.

## Consequences

- Refreshes keep working against the legacy SQLite database without manual intervention.
- The startup path now performs a small schema-compatibility check before the app serves requests.
- Future schema drift of this kind should get a matching startup migration or a real migration step, instead of relying on `create_all()`.
