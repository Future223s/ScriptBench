# Workflow Authoring and Selection

## Overview

Support creating a workflow definition, naming the workflow stage, choosing the model family and model, declaring grouping inputs, writing transcription instructions, attaching examples, choosing batch mode, selecting the workflow sample set, and managing the workflow lifecycle from the dashboard.

## UI

- Provide a workflow authoring flow that feels like one guided decision path rather than a form dump.
- Let the user choose the workflow name, stage, model family, and model.
- Let the user search the candidate sample set with contains-style matching, choose which grouping or membership filter narrows the sample set, and bulk-select the visible matches.
- Let the user select samples explicitly or by bulk selection from the filtered list.
- Let the user enter prompt instructions, add examples when needed, and choose batch behavior.
- Keep the dashboard readable so the created workflow appears as a distinct, selectable item.

## API

- Use the dashboard endpoint to list existing workflows.
- Use the grouping and sample endpoints to populate the workflow authoring picker and selection filters.
- Filter the loaded samples locally in the workflow wizard so search, contains matching, and bulk-select remain responsive.
- Use the workflow creation endpoint to persist the workflow definition and selected sample set.
- Use the workflow delete endpoint when the user removes a workflow from the dashboard.
- Re-fetch the dashboard after workflow creation or deletion so the list stays current.

## Storage

- Write to `workflows` when creating a workflow.
- Write to `workflow_samples` when attaching a sample set to a workflow.
- Read from `workflows` to list and open workflows, and read from `workflow_samples` to recover the selected sample set.
- Use the workflow ordering by recent update time when showing the dashboard.

## Open Questions

- The current workflow record stores the stage name, model family, model, and prompt spec together, but the long-term boundary between authoring metadata and execution metadata is still a little soft.
- The dashboard currently treats workflow opening and workflow selection as separate behaviors, but the UI expectations for those actions are not fully settled.
- The current code allows sample selection during workflow creation, and that picker now supports local search and contains matching, but it does not yet expose a dedicated workflow-sample management view after creation.
