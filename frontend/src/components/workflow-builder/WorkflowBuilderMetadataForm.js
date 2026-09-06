"use client";

import {
  Field,
  Panel,
  Select,
  Stack,
  StatusBadge,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

export function WorkflowBuilderMetadataForm({ state, actions }) {
  return (
    <Panel title="Workflow details" density="compact">
      <Stack gap="compact">
        <Field label="Workflow name" density="compact">
          <TextInput
            id="workflow-name"
            value={state.workflowDraft.workflow_name}
            onChange={(event) =>
              actions.setWorkflowDraftField("workflow_name", event.target.value)
            }
            placeholder="Workflow name"
          />
        </Field>
        <Field label="Workflow description" density="compact">
          <Textarea
            id="workflow-description"
            size="compact"
            rows="2"
            value={state.workflowDraft.workflow_description}
            onChange={(event) =>
              actions.setWorkflowDraftField(
                "workflow_description",
                event.target.value,
              )
            }
            placeholder="Optional description"
          />
        </Field>
        <Field label="Sample set" density="compact">
          <Select
            id="workflow-sample-set"
            value={state.workflowDraft.sample_set_id || ""}
            onChange={(event) =>
              actions.setWorkflowDraftField(
                "sample_set_id",
                Number(event.target.value) || null,
              )
            }
          >
            <option value="">Choose a sample set</option>
            {state.sampleSets.length ? (
              state.sampleSets.map((sampleSet) => (
                <option
                  key={sampleSet.sample_set_id}
                  value={sampleSet.sample_set_id}
                >
                  {sampleSet.sample_set_name} (
                  {sampleSet.sample_ids?.length || 0} samples)
                </option>
              ))
            ) : (
              <option value="">No sample sets available</option>
            )}
          </Select>
        </Field>
        <StatusBadge>
          {state.sampleSets.length
            ? `${state.sampleSets.length} sample sets available.`
            : "No sample sets available."}
        </StatusBadge>
      </Stack>
    </Panel>
  );
}
