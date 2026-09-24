"use client";

import {
  CompactFilterBar,
  EmptyState,
  Inline,
  StatusBadge,
} from "../../ui/primitives/index.js";

function filterDefaultValue(filter) {
  return filter.defaultValue ?? "";
}

function activeFilterLabel(filter) {
  const option = (filter.options || []).find(
    (item) => String(item.value) === String(filter.value),
  );
  const value = option?.label || String(filter.value || "").trim();
  return `${filter.label}: ${value}`;
}

export function FileManagementListPanel({
  title,
  description,
  filters,
  actions,
  summary,
  rows,
  emptyState,
}) {
  const activeFilters = filters
    .filter(
      (filter) =>
        String(filter.value ?? "") !== String(filterDefaultValue(filter)),
    )
    .map((filter) => ({
      id: filter.id,
      label: activeFilterLabel(filter),
      onRemove: () => filter.onChange?.(filterDefaultValue(filter)),
    }));

  return (
    <section className="file-management-list-panel">
      <header className="file-management-list-panel__header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <Inline gap="compact">
          {summary ? <StatusBadge>{summary}</StatusBadge> : null}
          {actions}
        </Inline>
      </header>
      {filters.length ? (
        <CompactFilterBar
          filters={filters}
          activeFilters={activeFilters}
          onClearAll={() =>
            filters.forEach((filter) =>
              filter.onChange?.(filterDefaultValue(filter)),
            )
          }
          ariaLabel={`${title} filters`}
        />
      ) : null}
      {rows || <EmptyState title={emptyState} />}
    </section>
  );
}
