## Line Crop Transcription Workflow

This workflow describes how a user prepares line-crop samples, groups them by source sample, runs a transcription workflow, and reviews the assembled outputs.

### Preconditions

- The user has a folder of source samples with corresponding ground truth text.
- The user has a separate folder of line-crop samples derived from those source samples.

### Workflow

1. The user uploads the source sample folder together with the corresponding ground truth files.
2. The user uploads the line-crop folder without ground truth text.
3. The user creates a grouping named `EMMO Sample` and uses the picker search controls to narrow the loaded line crops, for example with a contains filter such as `line`, then uses Select all visible to assign them quickly.
4. The user creates the grouping values for `EMMO Sample` by searching for the relevant samples and using bulk select to assign them quickly.
5. The user creates a workflow named `Line Crops` with model family `gemini`, model `gemini-3-flash-preview`, and stage `Iteration 1`.
6. The user opens sample selection, filters by the membership in the `EMMO Sample` grouping, narrows the visible line-crop samples with a contains search when needed, and bulk-selects the visible results for the workflow.
7. The user enters transcription instructions, selects batch mode, and accepts the generated JSON array output format.
8. The workflow appears in the dashboard, and the user opens it.
9. The workflow workspace opens with workflow identification at the top, a stage sidebar on the left, and a comparison area on the right.
10. The user opens a stage view, which replaces the comparison area with an execution panel featuring transcription jobs above and transcription assembly below.
11. The job area shows pending, queued, and completed panels with scrollable job cards. Selecting a job opens a dismissible modal with the full job details so the user can verify the derived prompt spec aligns with their intention.
12. The pending panel supports queueing jobs, selecting samples to queue, and queueing all. The queued panel supports unqueueing selected samples or all jobs. The completed panel supports retranscribing completed jobs. The user selects a sample to queue, opens the detail view once it is moved to the completed panel, inspects the raw model output, and queues all jobs upon verifying expected output shape.
13. The user clicks a configure assembly button in the transcription assembly section. They select `EMMO Sample` for output groupings so that one output file is constructed for all the lines corresponding to a sample. The system partitions outputs by distinct group membership combinations and stores each assembled transcription with `workflow_id`, `workflow_stage`, `output_name`, and the group-membership JSON payload.
15. Assemble all is clicked and the user reviews the assembled transcriptions in a master-detail comparison view with search, sorting, ground truth comparison, and source metadata.
16. Satisfied with the assembled transcriptions, the user clicks score all and each master-detail view is enriched with transcription quality metrics. An aggregate metrics bar appears is populated with the averaged metrics.

### Outcome

- The workflow produces grouped transcription jobs, persisted transcription outputs, and a reviewable comparison surface for analysis.
