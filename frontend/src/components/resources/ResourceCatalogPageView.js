"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { SampleFilterPanel } from "../file-management/SampleFilterPanel.js";
import { ResourceCatalogOverlays } from "./ResourceCatalogOverlays.js";
import { resourceFilterConfig, resourceModes } from "../../hooks/resources/resourceCatalogShared.js";

function ResourceRow({ row, actions, selected }) {
  return (
    <button
      className={["sample-row", "file-sample-row", "resource-row", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
      type="button"
      onClick={() => actions.openResourceDetail(row.type, row.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        actions.toggleArtifactGroupSelection(row.id, true);
      }}
    >
      <div className="sample-main">
        <strong>{row.name}</strong>
        <div className="meta-line">
          {row.summaryFields.map((entry) => (
            <span key={entry}>{entry}</span>
          ))}
        </div>
        <p>{row.previewText || "No additional summary available."}</p>
      </div>
      <span className="badge">{row.badgeLabel}</span>
    </button>
  );
}

export function ResourceCatalogPageView({ state, actions }) {
  const mode = resourceModes[state.resourceType] || resourceModes["artifact-group"];
  const filters = resourceFilterConfig(state.resourceType, state, actions);
  const visibleArtifactGroupIds = state.visibleRecords
    .filter((row) => row.type === "artifact-group")
    .map((row) => row.id);
  const allVisibleArtifactGroupsSelected =
    state.resourceType === "artifact-group"
      && visibleArtifactGroupIds.length > 0
      && visibleArtifactGroupIds.every((recordId) => state.selectedArtifactGroupIds.includes(recordId));
  const rows = state.loading ? (
    <EmptyState>Loading {mode.shortTitle.toLowerCase()}...</EmptyState>
  ) : state.visibleRecords.length ? (
    state.visibleRecords.map((row) => (
      <ResourceRow
        key={row.id}
        row={row}
        actions={actions}
        selected={state.selectedArtifactGroupIds.includes(row.id)}
      />
    ))
  ) : (
    <EmptyState>No {mode.shortTitle.toLowerCase()} match the current filters.</EmptyState>
  );

  const filterActions = (
    <>
      <button className="btn-secondary" type="button" onClick={actions.applyFilters}>
        Apply filter
      </button>
      <button className="btn-secondary" type="button" onClick={() => actions.clearFilters(state.resourceType)} disabled={state.loading}>
        Clear
      </button>
      <button
        className="btn-secondary"
        type="button"
        onClick={allVisibleArtifactGroupsSelected ? actions.clearArtifactGroupSelection : actions.selectAllVisibleArtifactGroups}
        disabled={state.loading || state.resourceType !== "artifact-group" || !state.visibleRecords.length}
      >
        {allVisibleArtifactGroupsSelected ? "Unselect all" : "Select all"}
      </button>
      <button
        className="btn-danger"
        type="button"
        onClick={actions.deleteSelectedArtifactGroups}
        disabled={state.loading || state.resourceType !== "artifact-group" || !state.selectedArtifactGroupIds.length}
      >
        Delete selected
      </button>
    </>
  );

  return (
    <div className="page-surface resource-catalog-page">
      <header className="resource-catalog-page-header">
        <div className="resource-catalog-page-header-copy">
          <div className="resource-catalog-page-title">Resource Catalog</div>
          <p>Browse shared resources used across workflows without leaving the shell.</p>
        </div>
        <div className="resource-catalog-page-header-right">
          <div className="resource-catalog-page-header-center" role="tablist" aria-label="Resource catalog mode">
            {Object.entries(resourceModes).map(([key, item]) => (
              <button
                key={key}
                className={["mode-option", key === state.resourceType ? "is-active" : ""].filter(Boolean).join(" ")}
                type="button"
                onClick={() => actions.setResourceType(key)}
                aria-pressed={key === state.resourceType}
              >
                {item.title}
              </button>
            ))}
          </div>
          {state.resourceType === "artifact-group" ? (
            <button className="btn-primary btn-tight" type="button" onClick={actions.openCreateArtifactGroup}>
              Create artifact group
            </button>
          ) : null}
        </div>
      </header>
      <section className="resource-catalog-grid">
        <Panel className="file-mode-panel resource-catalog-panel">
          <div className="file-sample-stack resource-catalog-stack">
            <SampleFilterPanel
              filters={filters}
              actions={filterActions}
              summary={`${state.visibleRecords.length} ${mode.shortTitle.toLowerCase()}`}
              rows={rows}
              emptyState={`No ${mode.shortTitle.toLowerCase()} are available.`}
              listClass="sample-picker file-sample-picker resource-catalog-picker"
            />
          </div>
        </Panel>
      </section>
      <ResourceCatalogOverlays state={state} actions={actions} />
    </div>
  );
}
