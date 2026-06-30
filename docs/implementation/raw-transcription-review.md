# Raw Transcription Review

## Overview

Support browsing assembled transcriptions in a master-detail review view, inspecting the transcription text alongside the ground truth text, and reading the source metadata that explains where the output came from. This slice is about human review of the raw output, not scoring.

## UI

- Present a list on the left and a detail inspector on the right.
- Make search and sorting visible at the top of the review surface.
- Keep the selected transcription visible while the user compares other rows.
- Show the transcription text, the corresponding ground truth, and the source metadata in the detail pane.
- Make the review flow fast enough that a researcher can move across many samples without losing context.

## API

- Use the workspace endpoint to load the current transcription set.
- Use sample-detail or job-detail endpoints when the inspector needs the underlying source information.
- Use the dashboard or workflow endpoints only to anchor the selected workflow context.

## Storage

- Read `transcriptions` to populate the review list.
- Read `samples` to show ground truth and sample-related metadata.
- Read `transcription_jobs` and `transcription_job_samples` when the review surface needs execution context.
- Order the review list by whichever sort the UI applies, then fetch the matching detail record on selection.

## Open Questions

- The current workspace only shows completed transcription cards, not the richer master-detail comparison layout described in the workflow.
- It is not yet clear whether raw review should be stage-local, workflow-wide, or both.
- The current code does not expose a dedicated review API distinct from the workspace API.
