"use client";

import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  Inline,
  ListRow,
  Panel,
  Stack,
  StepStrip,
} from "../../ui/primitives/index.js";
import { SampleFilterPanel } from "../file-management/SampleFilterPanel.js";
import { WorkflowStepsOverlays } from "./WorkflowStepsOverlays.js";
import { workflowStepsFilterConfig } from "../../hooks/workflow-steps/workflowStepsShared.js";

function WorkflowStepRow({ row, actions, selected }) {
  return (
    <ListRow
      title={row.name}
      detail={[...(row.summaryFields || []), row.previewText]
        .filter(Boolean)
        .join(" / ")}
      selected={selected}
      onContextMenu={(event) => {
        event.preventDefault();
        actions.toggleWorkflowStepSelection(row.type, row.id, true);
      }}
      action={
        <Inline gap="compact">
          <Button
            size="compact"
            onClick={() => actions.openWorkflowStepDetail(row.type, row.id)}
          >
            View
          </Button>
          <IconButton
            label={`Delete ${row.name}`}
            variant="danger"
            onClick={() => actions.deleteWorkflowStep(row.id)}
          >
            <Icon name="delete" />
          </IconButton>
        </Inline>
      }
    />
  );
}

export function WorkflowStepsPageView({ state, actions }) {
  const filters = workflowStepsFilterConfig("workflow-step", state, actions).map(
    (filter) => ({
      ...filter,
      action:
        filter.id === "resource-workflow-step-payload-template" ? (
          <Button size="compact" onClick={actions.openCreatePayloadTemplate}>
            Create
          </Button>
        ) : filter.id === "resource-workflow-step-output-specification" ? (
          <Button size="compact" onClick={actions.openCreateOutputSpec}>
            Create
          </Button>
        ) : null,
    }),
  );
  const rows = state.loading ? (
    <EmptyState title="Loading workflow steps" />
  ) : state.visibleRecords.length ? (
    state.visibleRecords.map((row) => (
      <WorkflowStepRow key={row.id} row={row} actions={actions} selected={false} />
    ))
  ) : (
    <EmptyState>No workflow steps match the current filters.</EmptyState>
  );

  return (
    <div className="page-surface workflow-steps-page">
      <header className="workflow-steps-page__header">
        <h1>Workflow Steps</h1>
        <StepStrip
          steps={[
            { id: "executor", label: "Executor", description: "Configure an executor" },
            {
              id: "payload",
              label: "Payload",
              description: "Create a payload",
            },
            {
              id: "output",
              label: "Output",
              description: "Specify the output",
            },
            {
              id: "assemble",
              label: "Assemble",
              description: "Create the step",
            },
          ]}
        />
        <Button variant="primary" onClick={actions.openCreateWorkflowStep}>
          Create workflow step
        </Button>
      </header>
      <section className="workflow-steps-grid">
        <Panel>
          <Stack gap="compact">
            <SampleFilterPanel
              filters={filters}
              actions={null}
              summary=""
              rows={rows}
              emptyState="No workflow steps are available."
              listClass="sample-picker file-sample-picker workflow-steps-picker"
            />
          </Stack>
        </Panel>
      </section>
      <WorkflowStepsOverlays state={state} actions={actions} />
    </div>
  );
}
