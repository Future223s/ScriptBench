"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { formatDate } from "../../utils/date.js";
import { truncate } from "../../utils/html.js";
import { SampleFilterPanel } from "./SampleFilterPanel.js";
import {
  managementModes,
  recordIdForType,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function artifactGroupLookup(artifactGroups) {
  return new Map(artifactGroups.map((group) => [String(group.artifact_group_id), group]));
}

function recordDisplayName(type, record) {
  if (type === "artifact") return record.artifact_name;
  if (type === "asset") return record.asset_name;
  return record.sample_name || record.sample_id;
}

function recordSummary(type, record, sampleSets, artifactGroups) {
  if (type === "artifact") {
    const groupName = record.artifact_group_name || artifactGroupLookup(artifactGroups).get(String(record.artifact_group_id || ""))?.artifact_group_name;
    return [
      `Origin: ${record.originating_sample_id}`,
      groupName ? `Group: ${groupName}` : "Ungrouped",
      `Category: ${record.artifact_category}`,
      record.updated_at ? formatDate(record.updated_at) : "",
    ].filter(Boolean);
  }

  if (type === "asset") {
    return [
      `Type: ${record.asset_type}`,
      record.asset_mime_type ? `Mime: ${record.asset_mime_type}` : "",
      record.updated_at ? formatDate(record.updated_at) : "",
      record.asset_blob_size ? `${record.asset_blob_size} bytes` : "",
    ].filter(Boolean);
  }

  const memberships = sampleSetMemberships(record.sample_id, sampleSets);
  return [
    record.sample_mime_type ? `Mime: ${record.sample_mime_type}` : "",
    record.updated_at ? String(record.updated_at) : "",
    `${memberships.length} sample set${memberships.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
}

function sampleSetMemberships(sampleId, sampleSets) {
  return sampleSets.filter((sampleSet) => Array.isArray(sampleSet.sample_ids) && sampleSet.sample_ids.includes(sampleId));
}

export function ManagementFields({ type, draft, actions }) {
  if (type === "sample") {
    return (
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="sample-set-name">Sample set name</label>
          <input
            id="sample-set-name"
            name="sample_set_name"
            value={draft.sample_set_name}
            onChange={(event) => actions.setDraftField("sample_set_name", event.target.value)}
            placeholder="EMMO line crops"
            required
          />
        </div>
        <div className="field wide">
          <label htmlFor="sample-set-description">Description</label>
          <input
            id="sample-set-description"
            name="sample_set_description"
            value={draft.sample_set_description}
            onChange={(event) => actions.setDraftField("sample_set_description", event.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>
    );
  }

  if (type === "artifact") {
    return (
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="artifact-group-name">Artifact group name</label>
          <input
            id="artifact-group-name"
            name="artifact_group_name"
            value={draft.artifact_group_name}
            onChange={(event) => actions.setDraftField("artifact_group_name", event.target.value)}
            placeholder="Document pages"
            required
          />
        </div>
        <div className="field wide">
          <label htmlFor="artifact-group-description">Description</label>
          <input
            id="artifact-group-description"
            name="artifact_group_description"
            value={draft.artifact_group_description}
            onChange={(event) => actions.setDraftField("artifact_group_description", event.target.value)}
            placeholder="Optional notes"
          />
        </div>
      </div>
    );
  }

  return null;
}

function RecordRow({
  type,
  record,
  selected,
  deletable,
  actions,
  sampleSets,
  artifactGroups,
}) {
  const recordId = recordIdForType(type, record);
  const displayName = recordDisplayName(type, record);
  const summary = recordSummary(type, record, sampleSets, artifactGroups);
  const badgeLabel =
    type === "artifact"
      ? record.artifact_group_name || "Ungrouped"
      : type === "asset"
        ? record.asset_type
        : record.ground_truth_text ? "Ground truth" : "Empty";

  function handleContextMenu(event) {
    event.preventDefault();
    actions.toggleSelection(type, recordId, !selected);
  }

  const content = (
    <>
      <div className="sample-main">
        <strong>{displayName || recordId}</strong>
        <div className="meta-line">
          <span>{recordId}</span>
          {summary.map((entry) => (
            <span key={entry}>{entry}</span>
          ))}
        </div>
        <p>
          {type === "sample"
            ? truncate(record.ground_truth_text)
            : type === "artifact"
              ? truncate(record.artifact_mime_type || "")
              : truncate(record.asset_mime_type || "")}
        </p>
      </div>
      <span className={["badge", type === "sample" && record.ground_truth_text ? "green" : ""].filter(Boolean).join(" ")}>
        {badgeLabel}
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
          onChange={(event) => actions.toggleSelection(type, recordId, event.target.checked)}
        />
        {content}
      </label>
    );
  }

  return (
    <button
      className={["sample-row", "file-sample-row", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
      type="button"
      onClick={() => actions.openRecord(type, recordId)}
      onContextMenu={handleContextMenu}
    >
      {content}
    </button>
  );
}

function filterSummary(type, visibleCount) {
  const label = managementModes[type].title.toLowerCase();
  return `${visibleCount} ${label}`;
}

export function SampleManagementPanel({ state, actions }) {
  const type = managementModes[state.managementType] ? state.managementType : "sample";
  const mode = managementModes[type];
  const visibleRecords = visibleRecordsForType(state, type);
  const selectedIds = state.selections[type] || [];
  const hasSelectedRecords = selectedIds.length > 0;
  const visibleRecordIds = visibleRecords.map((record) => recordIdForType(type, record));
  const allVisibleSelected = visibleRecordIds.length > 0 && visibleRecordIds.every((recordId) => selectedIds.includes(recordId));
  const rows = state.loading ? (
    <EmptyState>Loading {mode.title.toLowerCase()}...</EmptyState>
  ) : visibleRecords.length ? (
    visibleRecords.map((record) => (
      <RecordRow
        key={recordIdForType(type, record)}
        type={type}
        record={record}
        deletable={false}
        selected={selectedIds.includes(recordIdForType(type, record))}
        actions={actions}
        sampleSets={state.sampleSets}
        artifactGroups={state.artifactGroups}
      />
    ))
  ) : (
    <EmptyState>No {mode.title.toLowerCase()} match the current filters.</EmptyState>
  );

  const filters =
    type === "sample"
      ? [
          {
            id: "sample-search",
            label: "Search",
            kind: "text",
            value: state.filters.sample.query,
            placeholder: "Sample ID, name, or ground truth",
            onChange: (value) => actions.setFilterField("sample", "query", value),
          },
          {
            id: "sample-match-mode",
            label: "Match",
            kind: "select",
            value: state.filters.sample.queryMode,
            onChange: (value) => actions.setFilterField("sample", "queryMode", value),
            options: [
              { value: "contains", label: "Contains" },
              { value: "starts-with", label: "Begins with" },
              { value: "exact", label: "Exact" },
            ],
          },
          {
            id: "sample-set-filter",
            label: "Sample set",
            kind: "select",
            value: state.filters.sample.sampleSetId,
            onChange: (value) => actions.setFilterField("sample", "sampleSetId", value),
            options: [
              { value: "", label: "All sample sets" },
              ...state.sampleSets.map((sampleSet) => ({
                value: String(sampleSet.sample_set_id),
                label: sampleSet.sample_set_name,
              })),
            ],
          },
        ]
      : type === "artifact"
        ? [
            {
              id: "artifact-search",
              label: "Search",
              kind: "text",
              value: state.filters.artifact.query,
              placeholder: "Artifact name, source sample, or group",
              onChange: (value) => actions.setFilterField("artifact", "query", value),
            },
            {
              id: "artifact-match-mode",
              label: "Match",
              kind: "select",
              value: state.filters.artifact.queryMode,
              onChange: (value) => actions.setFilterField("artifact", "queryMode", value),
              options: [
                { value: "contains", label: "Contains" },
                { value: "starts-with", label: "Begins with" },
                { value: "exact", label: "Exact" },
              ],
            },
            {
              id: "artifact-group-filter",
              label: "Artifact group",
              kind: "select",
              value: state.filters.artifact.artifactGroupId,
              onChange: (value) => actions.setFilterField("artifact", "artifactGroupId", value),
              options: [
                { value: "", label: "All groups" },
                ...state.artifactGroups.map((group) => ({
                  value: String(group.artifact_group_id),
                  label: group.artifact_group_name,
                })),
              ],
            },
            {
              id: "artifact-category-filter",
              label: "Category",
              kind: "select",
              value: state.filters.artifact.artifactCategory,
              onChange: (value) => actions.setFilterField("artifact", "artifactCategory", value),
              options: [
                { value: "", label: "All categories" },
                { value: "companion", label: "Companion" },
                { value: "decomposition", label: "Decomposition" },
              ],
            },
          ]
        : [
            {
              id: "asset-search",
              label: "Search",
              kind: "text",
              value: state.filters.asset.query,
              placeholder: "Asset name or type",
              onChange: (value) => actions.setFilterField("asset", "query", value),
            },
            {
              id: "asset-match-mode",
              label: "Match",
              kind: "select",
              value: state.filters.asset.queryMode,
              onChange: (value) => actions.setFilterField("asset", "queryMode", value),
              options: [
                { value: "contains", label: "Contains" },
                { value: "starts-with", label: "Begins with" },
                { value: "exact", label: "Exact" },
              ],
            },
            {
              id: "asset-type-filter",
              label: "Asset type",
              kind: "select",
              value: state.filters.asset.assetType,
              onChange: (value) => actions.setFilterField("asset", "assetType", value),
              options: [
                { value: "", label: "All asset types" },
                ...uniqueAssetTypes(state.assets).map((assetType) => ({ value: assetType, label: assetType })),
              ],
            },
          ];

  const filterActions = (
    <>
      <button className="btn-secondary" type="button" onClick={() => actions.applyFilters()}>
        Apply filter
      </button>
      <button className="btn-secondary" type="button" onClick={() => actions.clearFilters(type)} disabled={state.loading}>
        Clear
      </button>
      {type === "artifact" ? (
        <button
          className="btn-secondary"
          type="button"
          onClick={actions.refreshArtifactMappings}
          disabled={state.loading || state.refreshingArtifactMappings}
        >
          {state.refreshingArtifactMappings ? "Refreshing..." : "Refresh mappings"}
        </button>
      ) : null}
      <button
        className="btn-secondary"
        type="button"
        onClick={() => (allVisibleSelected ? actions.clearSelection(type) : actions.selectAllVisible())}
        disabled={state.loading || !visibleRecords.length}
      >
        {allVisibleSelected ? "Unselect all" : "Select all"}
      </button>
      <button className="btn-danger" type="button" onClick={() => actions.submitManagement("delete")} disabled={state.loading || !hasSelectedRecords}>
        Delete selected
      </button>
    </>
  );

  return (
    <Panel className="file-mode-panel">
      <div className="file-sample-stack">
        <SampleFilterPanel
          filters={filters}
          actions={filterActions}
          summary={filterSummary(type, visibleRecords.length)}
          rows={rows}
          listClass="sample-picker file-sample-picker"
        />
      </div>
    </Panel>
  );
}

function uniqueAssetTypes(assets) {
  return [...new Set(assets.map((asset) => String(asset.asset_type || "").trim()).filter(Boolean))].sort();
}
