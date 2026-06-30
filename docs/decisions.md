# Decisions Log

This file records the high-level implementation choices made while extending ScriptBench.

## Prompt Resolution Slice

- Touched: added a dedicated prompt resolution service and routed workspace job generation through it.
- Left as is: Gemini remains the current provider implementation; the provider abstraction was not widened yet.
- Left as is: the prompt-spec shape and workflow authoring flow still use the existing data model.

## Workspace Job Orchestration Slice

- Touched: split workspace job monitoring into status-aware buckets and added job status transition controls.
- Left as is: job transitions still use the existing `PATCH /api/transcription-jobs/{job_id}` endpoint instead of new queue-specific endpoints.
- Left as is: transcription assembly and scored analysis remain separate future slices.
