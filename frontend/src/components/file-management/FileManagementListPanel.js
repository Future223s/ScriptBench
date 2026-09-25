"use client";

import {
  Catalog,
  CompactFilterBar,
  EmptyState,
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
  controls,
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
    <Catalog
      title={title}
      description={description}
      meta={summary ? <StatusBadge>{summary}</StatusBadge> : null}
      actions={actions}
      controls={controls}
      filters={filters.length ? (
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
      ariaLabel={`${title} catalog`}
    >
      {rows || <EmptyState title={emptyState} />}
    </Catalog>
  );
}
