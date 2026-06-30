# Transcription Assembly

## Overview

Support turning job output into persisted transcription records, grouping outputs by workflow stage and sample membership, naming assembled outputs, and enforcing uniqueness for the final reviewable transcription records. This slice is the boundary where execution results become durable analysis artifacts.

## UI

- Provide an assembly control area inside the workspace.
- Let the user configure how transcription job fields map to final outputs.
- Let the user choose whether outputs are grouped by membership combinations or treated as direct per-sample results.
- Show when an assembly configuration will collapse multiple samples into one output or split outputs into distinct partitions.
- Make it easy to refresh the assembled output list after generation.

## API

- Use the workspace endpoint to load existing transcriptions into the workspace.
- Use an assembly action from the workspace to trigger output creation once an assembly configuration has been chosen.
- Use transcription persistence logic to write or update the assembled records after job output has been finalized.
- Refresh the workspace after assembly so the UI can show the new output set.

## Storage

- Read `transcription_jobs` and `transcription_job_samples` to determine which job outputs belong together.
- Read `workflow_samples` and sample-side grouping data to compute the output partitions.
- Write to `transcriptions` when a resolved output is ready for review.
- Query `transcriptions` by workflow when showing the assembled output set in the workspace.

## Open Questions

- The current schema is still sample-scoped, while the desired assembly model is grouping-scoped and stage-scoped. That is a high-signal mismatch and likely needs a table redesign.
- The current transcription record does not have a first-class output name field, even though the requirements want one.
- The intended uniqueness rule for assembled outputs is not represented in the current table shape.
- It is not yet clear whether assembly should happen automatically after job completion or only through an explicit user action.
