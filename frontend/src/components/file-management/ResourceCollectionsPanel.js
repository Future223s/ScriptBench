"use client";

import {
  Button,
  EmptyState,
  Inline,
  SelectableRow,
} from "../../ui/primitives/index.js";
import { FileManagementListPanel } from "./FileManagementListPanel.js";
import {
  createArtifactGroupFilterConfig,
  createSampleSetFilterConfig,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function CollectionRow({ type, record, selected, onSelectedChange }) {
  const isSampleSet = type === "sampleSet";
  const name = isSampleSet
    ? record.sample_set_name || `Sample set ${record.sample_set_id}`
    : record.artifact_group_name ||
      `Artifact group ${record.artifact_group_id}`;
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
      : state.managementType === "artifact"
        ? "artifactGroup"
        : null;
  if (!type) {
    return (
      <FileManagementListPanel
        title="Related collections"
        description="Collections are shown for Samples and Artifacts."
        filters={[]}
        actions={null}
        summary=""
        rows={null}
        emptyState="Switch to Samples or Artifacts to browse related collections."
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
    : createArtifactGroupFilterConfig({
        filters: state.filters.artifactGroup,
        artifactGroups: state.artifactGroups,
        onChange: (field, value) =>
          actions.setFilterField("artifactGroup", field, value),
      });
  const filterActions = (
    <Inline gap="default">
      <Button variant="primary" onClick={actions.openManagementModal}>
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
      Loading {isSampleSet ? "sample sets" : "artifact groups"}...
    </EmptyState>
  ) : records.length ? (
    records.map((record) => (
      <CollectionRow
        key={isSampleSet ? record.sample_set_id : record.artifact_group_id}
        type={type}
        record={record}
        selected={selectedIds.includes(
          String(isSampleSet ? record.sample_set_id : record.artifact_group_id),
        )}
        onSelectedChange={(selected) =>
          actions.toggleCollectionSelection(
            type,
            isSampleSet ? record.sample_set_id : record.artifact_group_id,
            selected,
          )
        }
      />
    ))
  ) : null;

  return (
    <FileManagementListPanel
      title={isSampleSet ? "Sample sets" : "Artifact groups"}
      filters={filters}
      actions={filterActions}
      summary={`${records.length} ${isSampleSet ? "sample sets" : "artifact groups"}`}
      rows={rows}
      emptyState={`No ${isSampleSet ? "sample sets" : "artifact groups"} match the current filters.`}
    />
  );
}
