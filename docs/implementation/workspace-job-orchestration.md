# Workspace Job Orchestration

## Overview

Support opening a workflow workspace, loading the workflow context, generating transcription jobs, showing jobs by status, opening detailed job views, and letting the user move jobs through the execution lifecycle. This is the operational layer between workflow definition and transcription output.

## UI

- Present a workspace header with the workflow identity and stage context.
- Show a clear job monitoring area with open and completed jobs separated visually.
- Make each job card compact but scannable, with status and timing information visible at a glance.
- Let the user open a job detail modal without leaving the workspace.
- Keep the workspace state obvious when a workflow is refreshed, reopened, or deleted.

## API

- Use the workspace endpoint to load the workflow, selected samples, jobs, and completed transcriptions.
- Use the workspace opened endpoint when the user enters a workflow workspace.
- Use the workspace jobs endpoint to generate jobs from the selected workflow samples.
- Use the transcription-job detail endpoint to fetch the full record for a job that the user opens.
- Use the transcription-job update endpoint when job state or retry-related fields change.

## Storage

- Read `workflows` to validate the workflow and stage being opened.
- Read `workflow_samples` to recover the selected sample set for the workspace.
- Read `transcription_jobs` to separate open and completed jobs.
- Read `transcription_job_samples` to show which samples are attached to each job.
- Read `transcriptions` to show already assembled outputs alongside the jobs.
- Use the current status values to partition jobs into open and completed groups in memory.

## Open Questions

- The current code treats pending, queued, and running as one open-job bucket in storage queries, even though the UI narrative wants a more detailed job queue breakdown.
- The current workspace view has open/completed job columns, but it does not yet implement the richer pending/queued/completed panels described in the workflow.
- There is no dedicated endpoint for queueing, unqueueing, or retranscribing specific jobs from the panel controls yet.
- The stage sidebar and stage-to-stage comparison area are still mostly a UI concept rather than a backed workspace capability.
