"use client";

import {
  Button,
  CompactFilterBar,
  DataTable,
  Icon,
  IconButton,
  Inline,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { WorkflowStepsOverlays } from "./WorkflowStepsOverlays.js";
import { workflowStepsFilterConfig } from "../../hooks/workflow-steps/workflowStepsShared.js";

function activeFilterTokens(filters) {
  return filters
    .filter((filter) => String(filter.value ?? "") !== "")
    .map((filter) => {
      const option = (filter.options || []).find(
        (item) => String(item.value) === String(filter.value),
      );
      return {
        id: filter.id,
        label: `${filter.label}: ${option?.label || filter.value}`,
        onRemove: () => filter.onChange?.(""),
      };
    });
}

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
      width: "17%",
      render: (row) => row.payloadTemplate || "—",
    },
    {
      id: "outputSpecification",
      label: "Output specification",
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
  const filters = workflowStepsFilterConfig("workflow-step", state, actions);
  const selectedRowId =
    state.detailType === "workflow-step"
      ? state.selectedResource?.raw?.id
      : undefined;

  return (
    <div className="page-surface workflow-steps-page">
      <header className="workflow-steps-page__header">
        <h1>Workflow Steps</h1>
        <Button variant="primary" onClick={actions.openCreateWorkflowStep}>
          Create workflow step
        </Button>
      </header>
      <section className="workflow-steps-catalog">
        <CompactFilterBar
          filters={filters}
          activeFilters={activeFilterTokens(filters)}
          onClearAll={() => actions.clearFilters("workflow-step")}
          actions={
            <Inline gap="compact">
              <Button
                size="compact"
                onClick={() => actions.openCreatePayloadTemplate()}
              >
                New payload template
              </Button>
              <Button size="compact" onClick={() => actions.openCreateOutputSpec()}>
                New output spec
              </Button>
            </Inline>
          }
          ariaLabel="Workflow step filters"
        />
        <DataTable
          ariaLabel="Workflow steps"
          columns={workflowStepColumns(actions)}
          rows={state.loading ? [] : state.visibleRecords}
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
      </section>
      <WorkflowStepsOverlays state={state} actions={actions} />
    </div>
  );
}
