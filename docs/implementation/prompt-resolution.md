# Prompt Resolution

## Overview

Resolve a workflow into the exact prompt payload that will be sent to the model. This includes validating the prompt spec, collecting the selected sample payloads, loading any example assets, ordering the content in the correct sequence, and producing the serialized prompt representation that job generation can persist.

## UI

- Expose prompt resolution as part of workflow authoring and job generation rather than as a separate low-level tool.
- Let the user inspect the derived prompt before jobs are generated, or at least inspect the resolved job payload after generation.
- Make it clear when examples are included, when they are skipped, and which samples are being transmitted.

## API

- Use the workspace job-generation endpoint to trigger prompt resolution.
- During job generation, load the workflow record, the selected workflow samples, and any referenced example assets.
- For each job batch, resolve the prompt before the job is inserted.
- Return the created job payload so the UI can inspect the result of prompt resolution indirectly through the job detail view.

## Storage

- Read `workflows` to load the stored prompt spec and workflow metadata.
- Read `workflow_samples` to determine which samples are part of the workflow.
- Read `samples` to fetch sample bytes, MIME types, and any ground truth or reference content needed for prompt construction.
- Persist the resolved prompt on `transcription_jobs`.
- Use the cache registry file only as a sidecar for model cache bookkeeping; it is not currently a database-backed workflow artifact.

## Open Questions

- Prompt resolution is currently tied to the Gemini client implementation, even though the workflow concept itself is broader than one model provider.
- There is no separate API endpoint for previewing a resolved prompt without generating jobs.
- The current code resolves sample uploads into file refs inside the model client, which makes the prompt pipeline harder to inspect from the outside.
- Cache support exists in code, but it is not yet surfaced as a first-class product decision in the workflow authoring flow.
