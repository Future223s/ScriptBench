"use client";

import {
  Button,
  EmptyState,
  Inline,
  SelectableRow,
} from "../../ui/primitives/index.js";
import { FileManagementListPanel } from "./FileManagementListPanel.js";
import {
  createDerivativeGroupFilterConfig,
  createSampleSetFilterConfig,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function CollectionRow({ type, record, selected, onSelectedChange }) {
  const isSampleSet = type === "sampleSet";
  const name = isSampleSet
    ? record.name || `Sample set ${record.id}`
    : record.name || `Derivative group ${record.id}`;
  const details = isSampleSet
    ? `${(record.sample_ids || []).length} samples`
    : record.mapping_type || "Mapping group";

  return (
    <SelectableRow
      title={name}
      detail={[details, record.created_at].filter(Boolean).join(" / ")}
      selected={selected}
      onSelectedChange={onSelectedChange}
    />
  );
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
  const rows = state.loading ? (
    <EmptyState>
      Loading {isSampleSet ? "sample sets" : "derivative groups"}...
    </EmptyState>
  ) : records.length ? (
    records.map((record) => (
      <CollectionRow
        key={isSampleSet ? record.id : record.id}
        type={type}
        record={record}
        selected={selectedIds.includes(
          String(isSampleSet ? record.id : record.id),
        )}
        onSelectedChange={(selected) =>
          actions.toggleCollectionSelection(
            type,
            isSampleSet ? record.id : record.id,
            selected,
          )
        }
      />
    ))
  ) : null;

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
