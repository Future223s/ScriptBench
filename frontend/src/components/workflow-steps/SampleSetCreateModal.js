"use client";

import { SampleFilterPanel } from "../file-management/SampleFilterPanel.js";
import {
  Button,
  Dialog,
  Field,
  Inline,
  Stack,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

export function SampleSetCreateModal({
  open,
  draft,
  filters,
  filterActions,
  samples,
  loading,
  actions,
}) {
  return (
    <Dialog
      open={open}
      title="Create sample set"
      description="Choose an ordered group of samples for workflow runs."
      size="wide"
      onClose={actions.closeCreateSampleSet}
      footer={
        <Inline gap="compact" justify="end">
          <Button onClick={actions.closeCreateSampleSet} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={actions.submitCreateSampleSet}
            disabled={loading}
          >
            {loading ? "Creating…" : "Create sample set"}
          </Button>
        </Inline>
      }
    >
      <Stack>
        <Field label="Sample set name">
          <TextInput
            id="sample-set-name"
            value={draft.name}
            onChange={(event) =>
              actions.updateCreateSampleSetField("name", event.target.value)
            }
            placeholder="Evaluation set"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            id="sample-set-description"
            rows="3"
            value={draft.description}
            onChange={(event) =>
              actions.updateCreateSampleSetField(
                "description",
                event.target.value,
              )
            }
            placeholder="Samples used for the evaluation workflow"
          />
        </Field>
        <SampleFilterPanel
          filters={filters}
          actions={filterActions}
          summary={`${draft.sampleIds.length} selected`}
          listClass="sample-set-selection-list"
          emptyState="No samples match the current filters."
          rows={
            samples.length ? (
              <>
                <div className="sample-set-selection-header">
                  <div>
                    <h3>Samples</h3>
                    <p>
                      Select samples in the order they should appear in the set.
                    </p>
                  </div>
                </div>
                {samples.map((sample) => {
                  const sampleId = String(sample.id);
                  const selectedIndex = draft.sampleIds.indexOf(sampleId);
                  return (
                    <label className="sample-set-selection-row" key={sampleId}>
                      <input
                        type="checkbox"
                        checked={selectedIndex >= 0}
                        onChange={() => actions.toggleSampleSetSample(sampleId)}
                      />
                      <span className="sample-set-selection-order">
                        {selectedIndex >= 0 ? selectedIndex + 1 : "—"}
                      </span>
                      <span>
                        <strong>{sample.name || sampleId}</strong>
                        <small>{sampleId}</small>
                      </span>
                    </label>
                  );
                })}
              </>
            ) : null
          }
        />
      </Stack>
    </Dialog>
  );
}
