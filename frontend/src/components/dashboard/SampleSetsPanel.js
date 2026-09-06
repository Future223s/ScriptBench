"use client";

import {
  EmptyState,
  Panel,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { SampleSetRow } from "./SampleSetRow.js";

export function SampleSetsPanel({
  sampleSets,
  selectedSampleSetId,
  onSelectSampleSet,
  onDeleteSampleSet,
}) {
  return (
    <Panel
      title="Sample sets"
      actions={<StatusBadge>{sampleSets.length}</StatusBadge>}
    >
      <Stack gap="compact">
        {sampleSets.length ? (
          sampleSets.map((sampleSet) => (
            <SampleSetRow
              key={sampleSet.sample_set_id}
              sampleSet={sampleSet}
              selected={
                Number(sampleSet.sample_set_id) === Number(selectedSampleSetId)
              }
              onSelect={() =>
                onSelectSampleSet?.(Number(sampleSet.sample_set_id))
              }
              onDelete={() =>
                onDeleteSampleSet?.(Number(sampleSet.sample_set_id))
              }
            />
          ))
        ) : (
          <EmptyState title="No sample sets" />
        )}
      </Stack>
    </Panel>
  );
}
