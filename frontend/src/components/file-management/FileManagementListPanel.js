"use client";

import { useEffect, useState } from "react";

import {
  Catalog,
  CatalogPagination,
  ColumnFilter,
  DataTable,
  EmptyState,
  StatusBadge,
  TextInput,
} from "../../ui/primitives/index.js";

function filterDefaultValue(filter) {
  return filter.defaultValue ?? "";
}

export function FileManagementListPanel({
  title,
  description,
  filters = [],
  actions,
  controls,
  summary,
  rows,
  records,
  columns,
  getRowId,
  getRowLabel,
  selectedRowId,
  selectedRowIds,
  onRowActivate,
  onRowSelectedChange,
  rowActions,
  pageSize = 8,
  emptyState,
}) {
  const [openFilterId, setOpenFilterId] = useState("");
  const [openRowActionsId, setOpenRowActionsId] = useState("");
  const [page, setPage] = useState(0);
  const searchFilter = filters.find((filter) => filter.kind !== "select");
  const columnFilters = new Map(
    filters
      .filter((filter) => filter.kind === "select")
      .map((filter) => [filter.id, filter]),
  );
  const filterSignature = filters
    .map((filter) => `${filter.id}:${String(filter.value ?? "")}`)
    .join("|");
  useEffect(() => {
    setPage(0);
    setOpenFilterId("");
    setOpenRowActionsId("");
  }, [title, filterSignature]);

  const recordList = records || [];
  const pageCount = Math.max(1, Math.ceil(recordList.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleRecords = recordList.slice(pageStart, pageStart + pageSize);
  const tableColumns = (columns || []).map((column, index, allColumns) => {
    const filter = columnFilters.get(column.filterId);
    if (!filter) return column;
    const defaultValue = filterDefaultValue(filter);
    const active = String(filter.value ?? "") !== String(defaultValue);
    return {
      ...column,
      header: (
        <ColumnFilter
          label={column.label}
          active={active}
          open={openFilterId === filter.id}
          align={column.filterAlign || (index === allColumns.length - 1 ? "end" : "start")}
          onToggle={() =>
            setOpenFilterId((current) => {
              setOpenRowActionsId("");
              return current === filter.id ? "" : filter.id;
            })
          }
        >
          {(filter.options || []).map((option) => (
            <button
              key={option.value}
              type="button"
              className={String(filter.value ?? "") === String(option.value) ? "is-selected" : undefined}
              onClick={() => {
                filter.onChange?.(option.value);
                setOpenFilterId("");
              }}
            >
              {option.label}
            </button>
          ))}
        </ColumnFilter>
      ),
    };
  });
  const catalogRows = columns ? (
    <DataTable
      ariaLabel={title}
      columns={tableColumns}
      rows={visibleRecords}
      getRowId={getRowId}
      getRowLabel={getRowLabel}
      selectedRowId={selectedRowId}
      selectedRowIds={selectedRowIds}
      onRowActivate={onRowActivate}
      onRowSelectedChange={onRowSelectedChange}
      rowActions={rowActions}
      openRowActionsId={openRowActionsId}
      onOpenRowActionsChange={(rowId) => {
        setOpenRowActionsId(rowId);
        if (rowId) setOpenFilterId("");
      }}
      emptyState={emptyState}
    />
  ) : rows;

  return (
    <Catalog
      title={title}
      description={description}
      meta={summary ? <StatusBadge>{summary}</StatusBadge> : null}
      actions={actions}
      search={searchFilter ? (
        <TextInput
          type="search"
          value={searchFilter.value ?? ""}
          placeholder={searchFilter.placeholder || searchFilter.label}
          aria-label={searchFilter.label}
          onChange={(event) => searchFilter.onChange?.(event.target.value)}
        />
      ) : null}
      controls={controls}
      footer={columns ? (
        <CatalogPagination
          start={recordList.length ? pageStart + 1 : 0}
          end={Math.min(pageStart + pageSize, recordList.length)}
          total={recordList.length}
          previousDisabled={safePage === 0}
          nextDisabled={safePage >= pageCount - 1}
          onPrevious={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
        />
      ) : null}
      ariaLabel={`${title} catalog`}
    >
      {catalogRows || <EmptyState title={emptyState} />}
    </Catalog>
  );
}
