## Problem

Evaluating transcription workflows requires a large amount of manual coordination. It is tedious to connect a sample image to its ground truth, transcription output, and downstream evaluation. Comparing outputs across workflows or models usually requires ad hoc tooling, and keeping track of hundreds of files makes the process brittle and hard to reproduce. External service failures also need to be handled without losing progress.

Filesystem-based workflows are fragile and difficult to scale. Scripts that handle prompt construction, transcription, quality analysis, and visualization are often tightly coupled to a specific workflow shape, which makes them hard to reuse across different approaches.

## Design Goals

- Provide interfaces for inspecting samples, ground truths, and transcription outputs.
- Provide a consistent pipeline for uploading samples, constructing transcription workflows, and analyzing results.
- Allow samples to be grouped and assembled into workflow outputs using stable rules.
- Correlate each sample image with its ground truth and model outputs.
- Handle external model failures with retry and requeue support while preserving persisted state.
- Facilitate comparison across models, workflows, and samples for detailed analysis.
