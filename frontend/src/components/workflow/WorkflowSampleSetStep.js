"use client";

import {
  DescriptionList,
  Field,
  Instruction,
  Panel,
  Select,
  Stack,
} from "../../ui/primitives/index.js";

export function WorkflowSampleSetStep({ workflowDraft, sampleSets, actions }) {
  const selectedId = Number(workflowDraft.sample_set_id) || null;
  const selected =
    sampleSets.find(
      (sampleSet) => Number(sampleSet.id) === selectedId,
    ) || null;
  return (
    <Stack gap="compact">
      <Field label="Sample set">
        <Select
          value={workflowDraft.sample_set_id || ""}
          onChange={(event) => actions.setWorkflowSampleSet(event.target.value)}
          disabled={!sampleSets.length}
          required
        >
          <option value="">Choose a sample set</option>
          {sampleSets.map((sampleSet) => (
            <option
              key={sampleSet.id}
              value={sampleSet.id}
            >
              {sampleSet.name} ({sampleSet.sample_ids?.length || 0}{" "}
              samples)
            </option>
          ))}
        </Select>
      </Field>
      <Panel
        variant="inset"
        title={selected?.name || "No sample set selected"}
      >
        <Stack gap="compact">
          <DescriptionList
            items={[
              ["Samples", selected?.sample_ids?.length || 0],
              ["Workflows", selected?.workflow_count || 0],
            ]}
          />
          <Instruction>
            The workflow uses this sample set as its backbone.
          </Instruction>
        </Stack>
      </Panel>
    </Stack>
  );
}
