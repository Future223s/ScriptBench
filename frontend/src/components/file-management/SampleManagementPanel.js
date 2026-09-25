"use client";

import { useEffect, useRef, useState } from "react";

import {
  Button,
  Field,
  Grid,
  Inline,
  TextInput,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";
import { truncate } from "../../utils/html.js";
import { FileManagementListPanel } from "./FileManagementListPanel.js";
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

function sampleSetMemberships(sampleId, sampleSets = []) {
  return sampleSets.filter(
    (sampleSet) =>
      Array.isArray(sampleSet.sample_ids) &&
      sampleSet.sample_ids.includes(sampleId),
  );
}

function membershipLabel(sampleId, sampleSets) {
  const memberships = sampleSetMemberships(sampleId, sampleSets);
  if (!memberships.length) return "—";
  const names = memberships.map((sampleSet) => sampleSet.name);
  return names.length > 2
    ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
    : names.join(", ");
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function recordColumns(type, sampleSets, derivativeGroups) {
  if (type === "document") {
    return [
      {
        id: "name",
        label: "Name",
        width: "36%",
        className: "ui-data-table__primary",
      },
      {
        id: "pages",
        label: "Pages",
        width: "16%",
        render: (record) => record.sample_count || 0,
      },
      {
        id: "pdf",
        label: "PDF",
        filterId: "document-pdf-filter",
        width: "18%",
        render: (record) => (record.has_blob ? "Available" : "Virtual"),
      },
      {
        id: "size",
        label: "Size",
        width: "14%",
        render: (record) => formatBytes(record.blob_size),
      },
      {
        id: "updated",
        label: "Updated",
        width: "16%",
        render: (record) => formatDate(record.updated_at) || "—",
      },
    ];
  }

  if (type === "derivative") {
    const groups = derivativeGroupLookup(derivativeGroups);
    return [
      {
        id: "name",
        label: "Name",
        width: "24%",
        className: "ui-data-table__primary",
        render: (record) => recordDisplayName(type, record) || record.id,
      },
      {
        id: "sample",
        label: "Source sample",
        width: "18%",
        render: (record) => record.sample_id || "Unmapped",
      },
      {
        id: "group",
        label: "Group",
        filterId: "derivative-group-filter",
        width: "18%",
        render: (record) =>
          groups.get(String(record.derivative_group_id || ""))?.name ||
          "Ungrouped",
      },
      {
        id: "category",
        label: "Category",
        filterId: "derivative-category-filter",
        width: "12%",
      },
      {
        id: "mime",
        label: "MIME type",
        width: "14%",
        render: (record) => record.mime_type || "—",
      },
      {
        id: "updated",
        label: "Updated",
        width: "14%",
        render: (record) => formatDate(record.updated_at) || "—",
      },
    ];
  }

  if (type === "asset") {
    return [
      {
        id: "name",
        label: "Name",
        width: "28%",
        className: "ui-data-table__primary",
        render: (record) => recordDisplayName(type, record) || record.id,
      },
      {
        id: "type",
        label: "Type",
        filterId: "asset-type-filter",
        width: "18%",
      },
      {
        id: "mime",
        label: "MIME type",
        width: "20%",
        render: (record) => record.mime_type || "—",
      },
      {
        id: "size",
        label: "Size",
        width: "14%",
        render: (record) => formatBytes(record.blob_size),
      },
      {
        id: "updated",
        label: "Updated",
        width: "20%",
        render: (record) => formatDate(record.updated_at) || "—",
      },
    ];
  }

  return [
    {
      id: "name",
      label: "Name",
      width: "20%",
      className: "ui-data-table__primary",
      render: (record) => recordDisplayName(type, record) || record.id,
    },
    {
      id: "document",
      label: "Document / position",
      width: "20%",
      render: (record) =>
        record.document_id
          ? `${record.document_id} / ${Number(record.document_position || 0) + 1}`
          : "Documentless",
    },
    {
      id: "sampleSets",
      label: "Sample sets",
      filterId: "sample-set-filter",
      width: "18%",
      render: (record) => membershipLabel(record.id, sampleSets),
    },
    {
      id: "groundTruth",
      label: "Ground truth",
      width: "28%",
      render: (record) => truncate(record.ground_truth_text, 72) || "—",
    },
    {
      id: "updated",
      label: "Updated",
      width: "14%",
      render: (record) => formatDate(record.updated_at) || "—",
    },
  ];
}

export function ManagementFields({ type, draft, actions }) {
  if (type === "sample") {
    return (
      <Grid columns={2}>
        <Field label="Sample set name">
          <TextInput
            id="sample-set-name"
            name="sampleSetName"
            value={draft.sampleSetName}
            onChange={(event) =>
              actions.setDraftField("sampleSetName", event.target.value)
            }
            placeholder="EMMO line crops"
            required
          />
        </Field>
        <Field label="Description">
          <TextInput
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
        </Field>
      </Grid>
    );
  }

  return null;
}

function filterSummary(type, visibleCount) {
  const label = managementModes[type].title.toLowerCase();
  return `${visibleCount} ${label}`;
}

export function SampleManagementPanel({ state, actions }) {
  const [sampleSetSelectionMode, setSampleSetSelectionMode] = useState(false);
  const managementWasOpen = useRef(false);
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
  useEffect(() => {
    setSampleSetSelectionMode(false);
  }, [type]);
  useEffect(() => {
    if (
      managementWasOpen.current &&
      !state.managementModalOpen &&
      type === "sample" &&
      !selectedIds.length
    ) {
      setSampleSetSelectionMode(false);
    }
    managementWasOpen.current = state.managementModalOpen;
  }, [state.managementModalOpen, type, selectedIds.length]);
  const selectionEnabled = type === "sample" && sampleSetSelectionMode;

  const filters =
    type === "document"
      ? [
          {
            id: "document-search",
            label: "Search",
            kind: "text",
            value: state.filters.document.query,
            defaultValue: "",
            placeholder: "Document name",
            onChange: (value) =>
              actions.setFilterField("document", "query", value),
          },
          {
            id: "document-pdf-filter",
            label: "PDF",
            kind: "select",
            value: state.filters.document.pdfStatus,
            defaultValue: "",
            onChange: (value) =>
              actions.setFilterField("document", "pdfStatus", value),
            options: [
              { value: "", label: "All documents" },
              { value: "available", label: "PDF available" },
              { value: "virtual", label: "Virtual only" },
            ],
          },
        ]
      : type === "sample"
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
              defaultValue: "",
              placeholder: "Derivative name, source sample, or group",
              onChange: (value) =>
                actions.setFilterField("derivative", "query", value),
            },
            {
              id: "derivative-group-filter",
              label: "Derivative group",
              kind: "select",
              value: state.filters.derivative.derivativeGroupId,
              defaultValue: "",
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
              defaultValue: "",
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
              defaultValue: "",
              placeholder: "Asset name or type",
              onChange: (value) =>
                actions.setFilterField("asset", "query", value),
            },
            {
              id: "asset-type-filter",
              label: "Asset type",
              kind: "select",
              value: state.filters.asset.assetType,
              defaultValue: "",
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

  const catalogActions = (
    <Inline gap="default">
      {type === "sample" ? (
        <Button size="compact" onClick={() => {
          actions.clearSelection(type);
          setSampleSetSelectionMode(true);
        }}>
          Create sample set
        </Button>
      ) : null}
      {type === "derivative" ? (
        <Button
          size="compact"
          onClick={actions.workflowStepsActions?.openCreateDerivativeGroup}
        >
          Create derivative group
        </Button>
      ) : null}
    </Inline>
  );

  const selectionControls = (
    <Inline gap="default">
      <Button
        size="compact"
        onClick={() =>
          allVisibleSelected
            ? actions.clearSelection(type)
            : actions.selectAllVisible()
        }
        disabled={state.loading || !visibleRecords.length}
      >
        {allVisibleSelected ? "Unselect all" : "Select all"}
      </Button>
      {type === "sample" && sampleSetSelectionMode ? (
        <>
          <Button size="compact" onClick={() => {
            actions.clearSelection(type);
            setSampleSetSelectionMode(false);
          }}>Cancel</Button>
          <Button size="compact" variant="primary" onClick={actions.openManagementModal} disabled={!hasSelectedRecords}>Confirm selection</Button>
        </>
      ) : null}
      {type !== "sample" && hasSelectedRecords ? (
        <Button
          size="compact"
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
      description={`All ${mode.title.toLowerCase()} in the Library.`}
      filters={filters}
      actions={catalogActions}
      summary={filterSummary(type, visibleRecords.length)}
      controls={selectionEnabled ? selectionControls : null}
      records={state.loading ? [] : visibleRecords}
      columns={recordColumns(type, sampleSets, derivativeGroups)}
      getRowId={(record) => recordIdForType(type, record)}
      getRowLabel={(record) => recordDisplayName(type, record)}
      selectedRowId={
        state.detailType === type ? state.selectedRecord?.id : undefined
      }
      selectedRowIds={selectionEnabled ? selectedIds : []}
      onRowActivate={(record) =>
        actions.openRecord(type, recordIdForType(type, record))
      }
      onRowSelectedChange={selectionEnabled ? (record, selected) =>
        actions.toggleSelection(type, recordIdForType(type, record), selected)
      : undefined}
      rowActions={(record) => {
        const recordId = recordIdForType(type, record);
        return [
          {
            id: "open",
            label: "Open details",
            onSelect: () => actions.openRecord(type, recordId),
          },
          ...(type === "document" ? [{
            id: "assemble",
            label: "Assemble PDF",
            disabled: !record.raw?.sample_count,
            onSelect: () => actions.assembleDocument(recordId),
          }] : []),
          {
            id: "delete",
            label: "Delete",
            tone: "danger",
            onSelect: () => actions.deleteRecord(type, recordId),
          },
        ];
      }}
      emptyState={
        state.loading
          ? `Loading ${mode.title.toLowerCase()}...`
          : `No ${mode.title.toLowerCase()} match the current filters.`
      }
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
