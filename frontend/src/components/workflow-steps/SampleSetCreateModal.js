"use client";

import { Modal } from "../common/Modal.js";
import { SampleFilterPanel } from "../file-management/SampleFilterPanel.js";

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
    <Modal
      open={open}
      panelClassName="sample-set-create-modal"
      data-modal="sample-set-create"
      onClick={(event) => {
        if (event.target === event.currentTarget)
          actions.closeCreateSampleSet();
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Sample Set</h2>
          <span>Choose an ordered group of samples for workflow runs.</span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateSampleSet}
        >
          Close
        </button>
      </div>
      <div className="modal-body sample-set-create-body">
        <div className="form-grid">
          <div className="field wide">
            <label htmlFor="sample-set-name">Sample set name</label>
            <input
              id="sample-set-name"
              value={draft.name}
              onChange={(event) =>
                actions.updateCreateSampleSetField("name", event.target.value)
              }
              placeholder="Evaluation set"
              autoFocus
            />
          </div>
          <div className="field wide">
            <label htmlFor="sample-set-description">Description</label>
            <textarea
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
          </div>
        </div>
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
      </div>
      <div className="modal-footer">
        <button
          className="btn-secondary"
          type="button"
          onClick={actions.closeCreateSampleSet}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          type="button"
          onClick={actions.submitCreateSampleSet}
          disabled={loading}
        >
          {loading ? "Creating…" : "Create sample set"}
        </button>
      </div>
    </Modal>
  );
}
