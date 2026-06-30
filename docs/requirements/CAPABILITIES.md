## Capability Areas

- Sample intake: upload source samples and line crops through bulk folder upload or individual file upload, store sample bytes and ground truth text, and retrieve samples for inspection.
- Sample filtering: search and filter samples by sample ID, sample content, or membership in a selected grouping.
- Grouping management: create groupings, search within the sample picker using contains-style matching, bulk-select visible samples, and assign group values.
- Workflow authoring: define a workflow with a name, workflow stage, model family, model, samples to transcribe, prompt spec, batch mode, examples, and output format.
- Prompt resolution: build the resolved prompt from workflow instructions, examples, selected sample assets, batching rules, and output format, including the required file uploads and cached model inputs.
- Workflow sample selection: search within the sample picker using contains-style matching, select workflow samples by membership filter or explicit selection, and use bulk select or clear actions.
- Workflow lifecycle: create, list, open, refresh, and delete workflows.
- Workspace loading: open a workflow workspace and load the workflow definition, selected samples, transcription jobs, and assembled transcriptions.
- Job generation: create transcription jobs from a workflow definition and selected samples, applying grouping and batching rules.
- Job monitoring: view transcription jobs by job status, inspect queue state, and open full job details on demand.
- Job retrying: requeue or retranscribe completed jobs.
- Transcription assembly: map job outputs into persisted transcriptions, partition outputs by group membership, and enforce uniqueness of assembled outputs.
- Raw transcription review: browse assembled transcriptions in a master-detail view, inspect transcription text and ground truth side by side, and review source metadata within a stage.
- Scored transcription analysis: compute transcription quality metrics such as CER, WER, line omissions, line additions, and hallucination counts.
- Comparison analysis: compare transcriptions across samples, workflows, and model outputs using sorting, search, and metrics in the comparison area.
- Aggregate metrics: display summary metrics across the reviewed set and expose a comparison-level metrics bar.
