"use client";

import {
  Button,
  DataTable,
  Inline,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";
import { FileManagementListPanel } from "./FileManagementListPanel.js";
import {
  createDerivativeGroupFilterConfig,
  createSampleSetFilterConfig,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function collectionName(type, record) {
  const isSampleSet = type === "sampleSet";
  return isSampleSet
    ? record.name || `Sample set ${record.id}`
    : record.name || `Derivative group ${record.id}`;
}

function collectionColumns(type) {
  const isSampleSet = type === "sampleSet";
  return [
    {
      id: "name",
      label: "Name",
      width: "38%",
      className: "ui-data-table__primary",
      render: (record) => collectionName(type, record),
    },
    isSampleSet
      ? {
          id: "samples",
          label: "Samples",
          width: "18%",
          className: "ui-data-table__numeric",
          render: (record) => (record.sample_ids || []).length,
        }
      : {
          id: "mappingType",
          label: "Mapping type",
          width: "24%",
          render: (record) => record.mapping_type || "—",
        },
    {
      id: "status",
      label: "Status",
      width: "18%",
      render: (record) => (
        <StatusBadge>{record.status || "draft"}</StatusBadge>
      ),
    },
    {
      id: "created",
      label: "Created",
      width: isSampleSet ? "26%" : "20%",
      render: (record) => formatDate(record.created_at) || "—",
    },
  ];
}

export function ResourceCollectionsPanel({ state, actions }) {
  const type =
    state.managementType === "sample"
      ? "sampleSet"
      : state.managementType === "derivative"
        ? "derivativeGroup"
        : null;
  if (!type) {
    return (
      <FileManagementListPanel
        title="Related collections"
        description="Collections are shown for Samples and Derivatives."
        filters={[]}
        actions={null}
        summary=""
        rows={null}
        emptyState="Switch to Samples or Derivatives to browse related collections."
      />
    );
  }
  const isSampleSet = type === "sampleSet";
  const records = visibleRecordsForType(state, type);
  const selectedIds = state.collectionSelections[type] || [];
  const filters = isSampleSet
    ? createSampleSetFilterConfig({
        filters: state.filters.sampleSet,
        onChange: (field, value) =>
          actions.setFilterField("sampleSet", field, value),
      })
    : createDerivativeGroupFilterConfig({
        filters: state.filters.derivativeGroup,
        derivativeGroups: state.derivativeGroups,
        onChange: (field, value) =>
          actions.setFilterField("derivativeGroup", field, value),
      });
  const filterActions = (
    <Inline gap="default">
      <Button
        variant="primary"
        onClick={
          isSampleSet
            ? actions.openManagementModal
            : actions.workflowStepsActions?.openCreateDerivativeGroup
        }
      >
        Create
      </Button>
      {selectedIds.length ? (
        <Button
          variant="danger"
          onClick={() => actions.deleteSelectedCollections(type)}
        >
          Delete selected
        </Button>
      ) : null}
    </Inline>
  );
  const rows = (
    <DataTable
      ariaLabel={isSampleSet ? "Sample sets" : "Derivative groups"}
      columns={collectionColumns(type)}
      rows={state.loading ? [] : records}
      getRowId={(record) => record.id}
      getRowLabel={(record) => collectionName(type, record)}
      selectedRowIds={selectedIds}
      onRowActivate={(record) => {
        const recordId = String(record.id);
        actions.toggleCollectionSelection(
          type,
          recordId,
          !selectedIds.includes(recordId),
        );
      }}
      onRowSelectedChange={(record, selected) =>
        actions.toggleCollectionSelection(type, record.id, selected)
      }
      emptyState={
        state.loading
          ? `Loading ${isSampleSet ? "sample sets" : "derivative groups"}...`
          : `No ${isSampleSet ? "sample sets" : "derivative groups"} match the current filters.`
      }
    />
  );

  return (
    <FileManagementListPanel
      title={isSampleSet ? "Sample sets" : "Derivative groups"}
      filters={filters}
      actions={filterActions}
      summary={`${records.length} ${isSampleSet ? "sample sets" : "derivative groups"}`}
      rows={rows}
      emptyState={`No ${isSampleSet ? "sample sets" : "derivative groups"} match the current filters.`}
    />
  );
}
