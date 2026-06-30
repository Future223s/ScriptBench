# ADR: Poll queued transcription jobs on the backend and broadcast job lifecycle events

## Status

Accepted

## Context

The workspace needs live updates when queued transcription jobs begin processing and when they complete. The backend already owns the canonical job state, so the UI should treat websocket messages as refresh signals rather than the source of truth.

## Decision

Run a backend polling worker that repeatedly claims queued transcription jobs in ascending `job_id` order, marks each job `running` before model execution, and then persists the final `completed` or `failed` state after the model call finishes. After each database commit, broadcast a websocket event for the matching lifecycle transition.

The frontend subscribes to the websocket stream, repaints the active job card immediately when it receives the `running` event, and refetches the workspace after `completed` or `failed` so the job moves into the correct column from the authoritative database state.

## Consequences

- The job queue keeps a stable visible order because the worker claims jobs by `job_id`.
- The UI stays responsive without relying on websocket delivery as the source of truth.
- If a websocket message is missed, the next workspace fetch still reconstructs the correct state.
- The backend now has a small always-on worker lifecycle to manage alongside the API process.
