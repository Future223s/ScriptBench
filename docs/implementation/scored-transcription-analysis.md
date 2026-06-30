# Scored Transcription Analysis

## Overview

Support evaluating transcription quality after raw review by computing metrics such as CER, WER, line omissions, line additions, and hallucination counts. This slice is the analysis layer that turns assembled transcriptions into scored results.

## UI

- Provide a score action that runs the evaluation across a review set.
- Show per-transcription metrics once scoring has completed.
- Show an aggregate metrics bar or summary so the user can see the set-level result at a glance.
- Keep scored analysis visually separate from the raw transcription review surface so the user understands they are looking at evaluation, not source transcription content.

## API

- Use a scoring endpoint or job to run the evaluation pass over selected transcriptions.
- Load the relevant transcription records and the associated ground truth text before scoring.
- Return the scored results to the UI and refresh the reviewed set afterward.

## Storage

- Read `transcriptions` for the model output to score.
- Read `samples` for ground truth text.
- Write metrics back to `transcriptions` or a related scoring result store once scoring finishes.
- Read scored rows back when populating the aggregate metrics bar or detailed metric chips.

## Open Questions

- Scoring logic exists in the codebase as a service layer, but there is no productized API route for it yet.
- It is not yet clear whether metrics should live on the transcription record, in a sibling analysis table, or both.
- The current scoring code computes both alignment-style and hallucination-style metrics, but the user-facing boundary between them still needs to be named consistently.
- Aggregate metrics are described in the workflow, but the current UI does not yet define where that summary belongs.
