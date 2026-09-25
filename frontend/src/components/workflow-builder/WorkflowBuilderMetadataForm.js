"use client";

import {
  Field,
  Panel,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

export function WorkflowBuilderMetadataForm({ state, actions }) {
  return (
    <Panel title="Workflow details" className="workflow-builder-details-panel">
      <Stack gap="compact">
        <Field label="Workflow name" density="compact">
          <TextInput
            id="workflow-name"
            value={state.workflowDraft.name}
            onChange={(event) =>
              actions.setWorkflowDraftField("name", event.target.value)
            }
            placeholder="Workflow name"
          />
        </Field>
        <Field label="Workflow description" density="compact">
          <Textarea
            id="workflow-description"
            size="compact"
            rows="2"
            value={state.workflowDraft.description}
            onChange={(event) =>
              actions.setWorkflowDraftField(
                "description",
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
                  key={sampleSet.id}
                  value={sampleSet.id}
                >
                  {sampleSet.name} (
                  {sampleSet.sample_ids?.length || 0} samples)
                </option>
              ))
            ) : (
              <option value="">No sample sets available</option>
            )}
          </Select>
        </Field>
        <Field label="Automatic execution" density="compact">
          <Select
            value={state.workflowDraft.execution_mode || "continuous"}
            onChange={(event) =>
              actions.setWorkflowDraftField("execution_mode", event.target.value)
            }
          >
            <option value="continuous">End-to-end</option>
            <option value="stage_by_stage">Stage-by-stage</option>
          </Select>
        </Field>
      </Stack>
    </Panel>
  );
}
