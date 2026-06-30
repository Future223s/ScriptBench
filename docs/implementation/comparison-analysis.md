# Comparison Analysis

## Overview

Support comparing transcriptions across samples, workflows, and model outputs using search, sorting, and metrics in a comparison area separate from the stage-local raw review view. This slice is the cross-cutting comparison surface for side-by-side analysis.

## UI

- Present a comparison area that stays available while the user navigates within a workflow.
- Let the user switch between stage-local review and broader comparison views without losing selection context.
- Keep search and sorting controls visible so the comparison view can be used as an analysis tool rather than just a read-only list.
- Make metric summaries visible enough to support quick scanning across many outputs.

## API

- Use the workspace endpoint as the base source of workflow transcriptions and job context.
- Use the transcription and scoring endpoints or data sources to populate comparison rows and metric summaries.
- Refresh the comparison area after new transcriptions are assembled or scored.

## Storage

- Read `transcriptions` as the core comparison dataset.
- Read `samples` for source context and ground truth comparison.
- Read `workflows` and `workflow_samples` when the comparison scope changes across workflows or stages.
- Read scored metrics from the transcription record or related analysis storage when the UI needs metric columns or summaries.

## Open Questions

- The current frontend contains a comparison concept, but it is mostly a mock and is not backed by a dedicated comparison API.
- The distinction between stage-local review and cross-workflow comparison needs to be made explicit in the product language and UI hierarchy.
- It is not yet clear which sorts are first-class in the comparison area versus what should remain secondary.
