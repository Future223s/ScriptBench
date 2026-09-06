"use client";

import {
  Button,
  Icon,
  IconButton,
  Inline,
  ListRow,
} from "../../ui/primitives/index.js";

export function SampleSetRow({
  sampleSet,
  selected = false,
  onSelect,
  onDelete,
}) {
  const sampleCount = Number(
    sampleSet?.sample_count ?? sampleSet?.sample_ids?.length ?? 0,
  );
  const workflowCount = Number(sampleSet?.workflow_count ?? 0);
  const sampleSetName = sampleSet?.sample_set_name || "Sample set";

  return (
    <ListRow
      title={sampleSetName}
      detail={`${sampleCount} samples · ${workflowCount} workflows`}
      selected={selected}
      action={
        <Inline gap="default">
          <Button
            size="compact"
            variant={selected ? "primary" : "secondary"}
            onClick={onSelect}
          >
            View
          </Button>
          <IconButton
            label={`Delete sample set ${sampleSetName}`}
            variant="danger"
            onClick={onDelete}
          >
            <Icon name="delete" />
          </IconButton>
        </Inline>
      }
    />
  );
}
