# ADR: Backfill legacy `transcriptions` columns on startup

## Status

Accepted

## Context

The bundled SQLite database predates the current `transcriptions` table shape. The workspace endpoint reads the full transcription row, so any missing column in that legacy table causes a hard failure during fetch.

## Decision

On engine initialization, the backend inspects the `transcriptions` table and adds any missing nullable columns needed by the current workspace and scoring flow before serving requests.

## Consequences

- The current app can continue to use the checked-in legacy SQLite database without a manual migration step.
- Workspace fetches stay compatible with older databases even when they do not yet have the current `transcriptions` columns.
- Future schema drift in `transcriptions` should get the same treatment only when it is a backward-compatible nullable addition, or a real migration if the change is structural.
