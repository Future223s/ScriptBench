"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { formatDate } from "../../utils/date.js";
import { truncate } from "../../utils/html.js";
import {
  filterSamplesForPicker,
  membershipsForSample,
  selectedGrouping,
  valuesForGrouping,
  visibleWorkflowSamples,
} from "../../utils/workflow.js";
import { SampleFilterPanel } from "./SampleFilterPanel.js";

const fileManagementModes = {
  "create-sample-set": {
    title: "Create sample set",
    description: "Package the visible samples into a sample set for workflow authoring.",
    submitLabel: "Save sample set",
  },
  "create-grouping": {
    title: "Create grouping",
    description: "Collect the currently visible samples under a shared grouping name.",
    submitLabel: "Save grouping",
  },
  "assign-grouping-value": {
    title: "Assign grouping value",
    description: "Choose an existing grouping and assign a value to the visible samples.",
    submitLabel: "Save value",
  },
  "delete-samples": {
    title: "Delete samples",
    description: "Select the filtered samples you want to remove.",
    submitLabel: "Delete selected",
  },
};

function SampleRow({ sample, groupings, deletable, selected, actions }) {
  const memberships = membershipsForSample(groupings, sample.sample_id);
  function handleContextMenu(event) {
    event.preventDefault();
    actions.toggleFileManagementSelection(sample.sample_id, !selected);
  }

  const content = (
    <>
      <div className="sample-main">
        <strong>{sample.sample_id}</strong>
        <div className="meta-line">
          <span>{sample.has_sample_blob ? `${sample.sample_blob_size} bytes` : "No file"}</span>
          <span>{formatDate(sample.updated_at)}</span>
          <span>{memberships.length} groups</span>
        </div>
        <p>{truncate(sample.ground_truth_text)}</p>
      </div>
      <span className={["badge", sample.ground_truth_text ? "green" : ""].filter(Boolean).join(" ")}>
        {sample.ground_truth_text ? "Ground truth" : "Empty"}
      </span>
    </>
  );

  if (deletable) {
    return (
      <label
        className={["sample-row", "file-sample-row", "is-deletable", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
        onContextMenu={handleContextMenu}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => actions.toggleFileManagementSelection(sample.sample_id, event.target.checked)}
        />
        {content}
      </label>
    );
  }

  return (
    <button
      className={["sample-row", "file-sample-row", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
      type="button"
      onClick={() => actions.openSample(sample.sample_id)}
      onContextMenu={handleContextMenu}
    >
      {content}
    </button>
  );
}

function ModeFields({ mode, draft, groupings, actions }) {
  if (mode === "create-sample-set") {
    return (
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="sample-set-name">Sample set name</label>
          <input
            id="sample-set-name"
            name="sample_set_name"
            value={draft.sample_set_name}
            onChange={(event) => actions.setFileManagementDraftField("sample_set_name", event.target.value)}
            placeholder="EMMO line crops"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="sample-set-type">Sample set type</label>
          <input
            id="sample-set-type"
            name="sample_set_type"
            value={draft.sample_set_type}
            onChange={(event) => actions.setFileManagementDraftField("sample_set_type", event.target.value)}
            placeholder="source, crop, evaluation"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="sample-set-description">Description</label>
          <input
            id="sample-set-description"
            name="sample_set_description"
            value={draft.sample_set_description}
            onChange={(event) => actions.setFileManagementDraftField("sample_set_description", event.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>
    );
  }

  if (mode === "assign-grouping-value") {
    const selectedGroupingName = draft.grouping_value_group_name || groupings[0]?.name || "";

    return (
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="grouping-value-group">Grouping</label>
          <select
            id="grouping-value-group"
            name="grouping_value_group_name"
            value={selectedGroupingName}
            onChange={(event) => actions.setFileManagementDraftField("grouping_value_group_name", event.target.value)}
            disabled={!groupings.length}
            required
          >
            {groupings.length ? (
              groupings.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))
            ) : (
              <option value="">No groupings available</option>
            )}
          </select>
        </div>
        <div className="field wide">
          <label htmlFor="grouping-value-name">Value name</label>
          <input
            id="grouping-value-name"
            name="grouping_value_name"
            value={draft.grouping_value_name}
            onChange={(event) => actions.setFileManagementDraftField("grouping_value_name", event.target.value)}
            placeholder="front page, handwritten, clean"
            required
          />
        </div>
      </div>
    );
  }

  if (mode === "delete-samples") {
    return null;
  }

  return (
    <div className="form-grid">
      <div className="field wide">
        <label htmlFor="grouping-name">Grouping name</label>
        <input
          id="grouping-name"
          name="grouping_name"
          value={draft.grouping_name}
          onChange={(event) => actions.setFileManagementDraftField("grouping_name", event.target.value)}
          placeholder="EMMO Sample"
          required
        />
      </div>
    </div>
  );
}

export function SampleManagementPanel({ state, actions }) {
  const mode = fileManagementModes[state.fileManagementMode] ? state.fileManagementMode : "create-grouping";
  const currentMode = fileManagementModes[mode];
  const selectedFilterGrouping = selectedGrouping(state.groupings, state.appliedFileManagementGroupFilter);
  const filteredSamples = filterSamplesForPicker(
    visibleWorkflowSamples(
      state.samples,
      state.groupings,
      state.appliedFileManagementGroupFilter,
      state.appliedFileManagementGroupFilterValue,
    ),
    state.appliedFileManagementQuery,
    state.appliedFileManagementQueryMode || "contains",
  );
  const filterGroupValues = valuesForGrouping(selectedFilterGrouping);
  const selectedSampleIds = state.fileManagementSelection.length ? state.fileManagementSelection : [];
  const rows = filteredSamples.length ? (
    filteredSamples.map((sample) => (
      <SampleRow
        key={sample.sample_id}
        sample={sample}
        groupings={state.groupings}
        deletable={mode === "delete-samples"}
        selected={selectedSampleIds.includes(sample.sample_id)}
        actions={actions}
      />
    ))
  ) : (
    <EmptyState>No samples match the current filters.</EmptyState>
  );

  return (
    <Panel className="file-mode-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>File management</h2>
          <span>{currentMode.title}</span>
        </div>
      </div>
      <div className="mode-header">
        <div className="mode-switch file-mode-switch">
          {Object.entries(fileManagementModes).map(([key, meta]) => (
            <button
              key={key}
              className={["mode-option", key === mode ? "is-active" : ""].filter(Boolean).join(" ")}
              type="button"
              onClick={() => actions.setFileManagementMode(key)}
              aria-pressed={key === mode}
            >
              {meta.title}
            </button>
          ))}
        </div>
        <button className="btn-primary file-mode-submit" type="submit" form="file-management-form">
          {currentMode.submitLabel}
        </button>
      </div>
      <form
        id="file-management-form"
        className="file-management-form"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.submitFileManagement();
        }}
      >
        <div className="mode-copy">
          <strong>{currentMode.title}</strong>
          <p>{currentMode.description}</p>
          <p className="mode-hint">Right-click a sample to add it to the selection.</p>
        </div>
        <ModeFields mode={mode} draft={state.fileManagementDraft} groupings={state.groupings} actions={actions} />
      </form>
      <div className="file-sample-stack">
        <SampleFilterPanel
          filters={[
            {
              id: "sample-search",
              label: "Search",
              kind: "text",
              value: state.fileManagementQuery,
              placeholder: "Sample ID or ground truth",
              onChange: (value) => actions.setFileManagementQuery(value),
            },
            {
              id: "sample-match-mode",
              label: "Match",
              kind: "select",
              value: state.fileManagementQueryMode || "contains",
              onChange: (value) => actions.setFileManagementQueryMode(value),
              options: [
                { value: "contains", label: "Contains" },
                { value: "starts-with", label: "Begins with" },
                { value: "exact", label: "Exact" },
              ],
            },
            {
              id: "sample-group-filter",
              label: "Group",
              kind: "select",
              value: state.fileManagementGroupFilter,
              onChange: (value) => actions.setFileManagementGroupFilter(value),
              options: [
                { value: "", label: "All groupings" },
                ...state.groupings.map((group) => ({ value: group.name, label: group.name })),
              ],
            },
            {
              id: "sample-group-filter-value",
              label: "Value",
              kind: "select",
              value: state.fileManagementGroupFilterValue,
              disabled: !state.fileManagementGroupFilter,
              onChange: (value) => actions.setFileManagementGroupFilterValue(value),
              options: [
                { value: "", label: "All values" },
                ...filterGroupValues.map((entry) => ({ value: entry.value, label: `${entry.value} (${entry.sampleIds.length})` })),
              ],
            },
          ]}
          actions={
            <>
              <button className="btn-secondary" type="button" onClick={() => actions.applyFileManagementFilter()}>
                Apply filter
              </button>
              <button className="btn-secondary" type="button" onClick={() => actions.selectAllFileManagement()}>
                Select all
              </button>
            </>
          }
          summary={
            mode === "delete-samples"
              ? `${filteredSamples.length} samples currently visible. ${state.fileManagementSelection.length} selected for deletion.`
              : `${filteredSamples.length} samples currently visible. ${state.fileManagementSelection.length} selected.`
          }
          rows={rows}
          listClass="sample-picker file-sample-picker"
        />
      </div>
    </Panel>
  );
}
