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

function derivativeGroupLookup(derivativeGroups = []) {
  return new Map(
    derivativeGroups.map((group) => [String(group.id), group]),
  );
}

function recordDisplayName(type, record) {
  if (type === "derivative") return record.name;
  if (type === "asset") return record.name;
  return record.name || record.id;
}

function recordSummary(type, record, sampleSets = [], derivativeGroups = []) {
  if (type === "derivative") {
    const groupName =
      derivativeGroupLookup(derivativeGroups).get(
        String(record.derivative_group_id || ""),
      )?.name;
    return [
      `Origin: ${record.sample_id || "Unmapped"}`,
      groupName ? `Group: ${groupName}` : "Ungrouped",
      `Category: ${record.category}`,
      record.updated_at ? formatDate(record.updated_at) : "",
    ].filter(Boolean);
  }

  if (type === "asset") {
    return [
      `Type: ${record.type}`,
      record.mime_type ? `Mime: ${record.mime_type}` : "",
      record.updated_at ? formatDate(record.updated_at) : "",
      record.blob_size ? `${record.blob_size} bytes` : "",
    ].filter(Boolean);
  }

  const memberships = sampleSetMemberships(record.id, sampleSets);
  return [
    record.mime_type ? `Mime: ${record.mime_type}` : "",
    record.updated_at ? String(record.updated_at) : "",
    `${memberships.length} sample set${memberships.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
}

function sampleSetMemberships(sampleId, sampleSets = []) {
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
            name="sampleSetName"
            value={draft.sampleSetName}
            onChange={(event) =>
              actions.setDraftField("sampleSetName", event.target.value)
            }
            placeholder="EMMO line crops"
            required
          />
        </div>
        <div className="field wide">
          <label htmlFor="sample-set-description">Description</label>
          <input
            id="sample-set-description"
            name="sampleSetDescription"
            value={draft.sampleSetDescription}
            onChange={(event) =>
              actions.setDraftField(
                "sampleSetDescription",
                event.target.value,
              )
            }
            placeholder="Optional notes"
          />
        </div>
      </div>
    );
  }

  if (type === "derivative") {
    return (
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="derivative-group-name">Derivative group name</label>
          <input
            id="derivative-group-name"
            name="derivativeGroupName"
            value={draft.derivativeGroupName}
            onChange={(event) =>
              actions.setDraftField("derivativeGroupName", event.target.value)
            }
            placeholder="Document pages"
            required
          />
        </div>
        <div className="field wide">
          <label htmlFor="derivative-group-description">Description</label>
          <input
            id="derivative-group-description"
            name="derivativeGroupDescription"
            value={draft.derivativeGroupDescription}
            onChange={(event) =>
              actions.setDraftField(
                "derivativeGroupDescription",
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
  derivativeGroups,
}) {
  const recordId = recordIdForType(type, record);
  const displayName = recordDisplayName(type, record);
  const summary = recordSummary(type, record, sampleSets, derivativeGroups);

  function handleContextMenu(event) {
    event.preventDefault();
    actions.toggleSelection(type, recordId, !selected);
  }

  const detail =
    type === "sample"
      ? truncate(record.ground_truth_text)
      : type === "derivative"
        ? truncate(record.mime_type || "")
        : truncate(record.mime_type || "");
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
  const sampleSets = state.sampleSets || [];
  const derivativeGroups = state.derivativeGroups || [];
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
        sampleSets={sampleSets}
        derivativeGroups={derivativeGroups}
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
          sampleSets,
          onChange: (field, value) =>
            actions.setFilterField("sample", field, value),
        })
      : type === "derivative"
        ? [
            {
              id: "derivative-search",
              label: "Search",
              kind: "text",
              value: state.filters.derivative.query,
              placeholder: "Derivative name, source sample, or group",
              onChange: (value) =>
                actions.setFilterField("derivative", "query", value),
            },
            {
              id: "derivative-match-mode",
              label: "Match",
              kind: "select",
              value: state.filters.derivative.queryMode,
              onChange: (value) =>
                actions.setFilterField("derivative", "queryMode", value),
              options: [
                { value: "contains", label: "Contains" },
                { value: "starts-with", label: "Begins with" },
                { value: "exact", label: "Exact" },
              ],
            },
            {
              id: "derivative-group-filter",
              label: "Derivative group",
              kind: "select",
              value: state.filters.derivative.derivativeGroupId,
              onChange: (value) =>
                actions.setFilterField("derivative", "derivativeGroupId", value),
              options: [
                { value: "", label: "All groups" },
                ...derivativeGroups.map((group) => ({
                  value: String(group.id),
                  label: group.name,
                })),
              ],
            },
            {
              id: "derivative-category-filter",
              label: "Category",
              kind: "select",
              value: state.filters.derivative.derivativeCategory,
              onChange: (value) =>
                actions.setFilterField("derivative", "derivativeCategory", value),
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
        .map((asset) => String(asset.type || "").trim())
        .filter(Boolean),
    ),
  ].sort();
}
