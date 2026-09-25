"use client";

import { useEffect, useState } from "react";

import {
  Button,
  Catalog,
  CatalogPagination,
  ColumnFilter,
  DataTable,
  Icon,
  IconButton,
  StatusBadge,
  TextInput,
} from "../../ui/primitives/index.js";
import { WorkflowStepsOverlays } from "./WorkflowStepsOverlays.js";
import { workflowStepsFilterConfig } from "../../hooks/workflow-steps/workflowStepsShared.js";

function workflowStepColumns(actions) {
  return [
    {
      id: "name",
      label: "Name",
      width: "20%",
      className: "ui-data-table__primary",
    },
    {
      id: "executor",
      label: "Executor",
      filterId: "resource-workflow-step-model-family",
      width: "18%",
      render: (row) => (
        <span className="workflow-step-executor">
          {row.executor || "—"}
          {row.model ? <small>{row.model}</small> : null}
        </span>
      ),
    },
    {
      id: "payloadTemplate",
      label: "Payload template",
      filterId: "resource-workflow-step-payload-template",
      width: "17%",
      render: (row) => row.payloadTemplate || "—",
    },
    {
      id: "outputSpecification",
      label: "Output specification",
      filterId: "resource-workflow-step-output-specification",
      width: "17%",
      render: (row) => row.outputSpecification || "—",
    },
    {
      id: "method",
      label: "Method",
      width: "12%",
      render: (row) => row.method || "—",
    },
    {
      id: "status",
      label: "Status",
      width: "10%",
      render: (row) => <StatusBadge>{row.status || "draft"}</StatusBadge>,
    },
    {
      id: "actions",
      label: "",
      width: "6%",
      className: "ui-data-table__actions",
      render: (row) => (
        <IconButton
          label={`Delete ${row.name}`}
          variant="danger"
          onClick={() => actions.deleteWorkflowStep(row.id)}
        >
          <Icon name="delete" />
        </IconButton>
      ),
    },
  ];
}

export function WorkflowStepsPageView({ state, actions }) {
  const [openFilterId, setOpenFilterId] = useState("");
  const [page, setPage] = useState(0);
  const filters = workflowStepsFilterConfig("workflow-step", state, actions);
  const searchFilter = filters.find((filter) => filter.kind !== "select");
  const columnFilters = new Map(
    filters
      .filter((filter) => filter.kind === "select")
      .map((filter) => [filter.id, filter]),
  );
  const filterSignature = filters
    .map((filter) => `${filter.id}:${String(filter.value ?? "")}`)
    .join("|");
  const records = state.loading ? [] : state.visibleRecords;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleRecords = records.slice(pageStart, pageStart + pageSize);
  const columns = workflowStepColumns(actions).map((column, index, allColumns) => {
    const filter = columnFilters.get(column.filterId);
    if (!filter) return column;
    const active = String(filter.value ?? "") !== "";
    return {
      ...column,
      header: (
        <ColumnFilter
          label={column.label}
          active={active}
          open={openFilterId === filter.id}
          align={index === allColumns.length - 1 ? "end" : "start"}
          onToggle={() =>
            setOpenFilterId((current) => current === filter.id ? "" : filter.id)
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
  const selectedRowId =
    state.detailType === "workflow-step"
      ? state.selectedResource?.raw?.id
      : undefined;

  useEffect(() => {
    setPage(0);
    setOpenFilterId("");
  }, [filterSignature]);

  return (
    <div className="page-surface workflow-steps-page">
      <Catalog
        title="Workflow Steps"
        description="Create and manage reusable workflow steps."
        actions={
          <Button variant="primary" onClick={actions.openCreateWorkflowStep}>
            Create workflow step
          </Button>
        }
        ariaLabel="Workflow steps catalog"
        search={searchFilter ? (
          <TextInput
            type="search"
            value={searchFilter.value ?? ""}
            placeholder={searchFilter.placeholder || searchFilter.label}
            aria-label={searchFilter.label}
            onChange={(event) => searchFilter.onChange?.(event.target.value)}
          />
        ) : null}
        footer={(
          <CatalogPagination
            start={records.length ? pageStart + 1 : 0}
            end={Math.min(pageStart + pageSize, records.length)}
            total={records.length}
            previousDisabled={safePage === 0}
            nextDisabled={safePage >= pageCount - 1}
            onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          />
        )}
      >
        <DataTable
          ariaLabel="Workflow steps"
          columns={columns}
          rows={visibleRecords}
          selectedRowId={selectedRowId}
          onRowActivate={(row) =>
            actions.openWorkflowStepDetail(row.type, row.id)
          }
          emptyState={
            state.loading
              ? "Loading workflow steps..."
              : "No workflow steps match the current filters."
          }
        />
      </Catalog>
      <WorkflowStepsOverlays state={state} actions={actions} />
    </div>
  );
}
