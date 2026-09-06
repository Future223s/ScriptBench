"use client";

import { Button, EmptyState, Inline } from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";
import { truncate } from "../../utils/html.js";
import { FileManagementListPanel } from "./FileManagementListPanel.js";
import { FileManagementRow } from "./FileManagementRow.js";
import {
  createSampleFilterConfig,
  managementModes,
  recordIdForType,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function artifactGroupLookup(artifactGroups) {
  return new Map(
    artifactGroups.map((group) => [String(group.artifact_group_id), group]),
  );
}

function recordDisplayName(type, record) {
  if (type === "artifact") return record.artifact_name;
  if (type === "asset") return record.asset_name;
  return record.sample_name || record.sample_id;
}

function recordSummary(type, record, sampleSets, artifactGroups) {
  if (type === "artifact") {
    const groupName =
      record.artifact_group_name ||
      artifactGroupLookup(artifactGroups).get(
        String(record.artifact_group_id || ""),
      )?.artifact_group_name;
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
  return sampleSets.filter(
    (sampleSet) =>
      Array.isArray(sampleSet.sample_ids) &&
      sampleSet.sample_ids.includes(sampleId),
  );
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
            onChange={(event) =>
              actions.setDraftField("sample_set_name", event.target.value)
            }
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
            onChange={(event) =>
              actions.setDraftField(
                "sample_set_description",
                event.target.value,
              )
            }
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
            onChange={(event) =>
              actions.setDraftField("artifact_group_name", event.target.value)
            }
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
            onChange={(event) =>
              actions.setDraftField(
                "artifact_group_description",
                event.target.value,
              )
            }
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

  function handleContextMenu(event) {
    event.preventDefault();
    actions.toggleSelection(type, recordId, !selected);
  }

  const detail =
    type === "sample"
      ? truncate(record.ground_truth_text)
      : type === "artifact"
        ? truncate(record.artifact_mime_type || "")
        : truncate(record.asset_mime_type || "");
  const conciseDescriptors = [summary[0], summary[summary.length - 1], detail]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);

  return (
    <FileManagementRow
      title={displayName || recordId}
      descriptors={conciseDescriptors}
      selected={selected}
      onClick={() => actions.openRecord(type, recordId)}
      onContextMenu={handleContextMenu}
    />
  );
}

function filterSummary(type, visibleCount) {
  const label = managementModes[type].title.toLowerCase();
  return `${visibleCount} ${label}`;
}

export function SampleManagementPanel({ state, actions }) {
  const type = managementModes[state.managementType]
    ? state.managementType
    : "sample";
  const mode = managementModes[type];
  const visibleRecords = visibleRecordsForType(state, type);
  const selectedIds = state.selections[type] || [];
  const hasSelectedRecords = selectedIds.length > 0;
  const visibleRecordIds = visibleRecords.map((record) =>
    recordIdForType(type, record),
  );
  const allVisibleSelected =
    visibleRecordIds.length > 0 &&
    visibleRecordIds.every((recordId) => selectedIds.includes(recordId));
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
    <EmptyState>
      No {mode.title.toLowerCase()} match the current filters.
    </EmptyState>
  );

  const filters =
    type === "sample"
      ? createSampleFilterConfig({
          filters: state.filters.sample,
          sampleSets: state.sampleSets,
          onChange: (field, value) =>
            actions.setFilterField("sample", field, value),
        })
      : type === "artifact"
        ? [
            {
              id: "artifact-search",
              label: "Search",
              kind: "text",
              value: state.filters.artifact.query,
              placeholder: "Artifact name, source sample, or group",
              onChange: (value) =>
                actions.setFilterField("artifact", "query", value),
            },
            {
              id: "artifact-match-mode",
              label: "Match",
              kind: "select",
              value: state.filters.artifact.queryMode,
              onChange: (value) =>
                actions.setFilterField("artifact", "queryMode", value),
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
              onChange: (value) =>
                actions.setFilterField("artifact", "artifactGroupId", value),
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
              onChange: (value) =>
                actions.setFilterField("artifact", "artifactCategory", value),
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
              onChange: (value) =>
                actions.setFilterField("asset", "query", value),
            },
            {
              id: "asset-match-mode",
              label: "Match",
              kind: "select",
              value: state.filters.asset.queryMode,
              onChange: (value) =>
                actions.setFilterField("asset", "queryMode", value),
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
              onChange: (value) =>
                actions.setFilterField("asset", "assetType", value),
              options: [
                { value: "", label: "All asset types" },
                ...uniqueAssetTypes(state.assets).map((assetType) => ({
                  value: assetType,
                  label: assetType,
                })),
              ],
            },
          ];

  const filterActions = (
    <Inline gap="default">
      <Button
        onClick={() =>
          allVisibleSelected
            ? actions.clearSelection(type)
            : actions.selectAllVisible()
        }
        disabled={state.loading || !visibleRecords.length}
      >
        {allVisibleSelected ? "Unselect all" : "Select all"}
      </Button>
      {hasSelectedRecords ? (
        <Button
          variant="danger"
          onClick={() => actions.submitManagement("delete")}
          disabled={state.loading}
        >
          Delete selected
        </Button>
      ) : null}
    </Inline>
  );

  return (
    <FileManagementListPanel
      title={mode.title}
      filters={filters}
      actions={filterActions}
      summary={filterSummary(type, visibleRecords.length)}
      rows={rows}
      emptyState={`No ${mode.title.toLowerCase()} match the current filters.`}
    />
  );
}

function uniqueAssetTypes(assets) {
  return [
    ...new Set(
      assets
        .map((asset) => String(asset.asset_type || "").trim())
        .filter(Boolean),
    ),
  ].sort();
}
