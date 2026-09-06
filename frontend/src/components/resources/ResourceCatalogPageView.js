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
import { ResourceCatalogOverlays } from "./ResourceCatalogOverlays.js";
import { resourceFilterConfig } from "../../hooks/resources/resourceCatalogShared.js";

function ResourceRow({ row, actions, selected }) {
  return (
    <ListRow
      title={row.name}
      detail={[...(row.summaryFields || []), row.previewText]
        .filter(Boolean)
        .join(" / ")}
      selected={selected}
      onContextMenu={(event) => {
        event.preventDefault();
        actions.toggleResourceSelection(row.type, row.id, true);
      }}
      action={
        <Inline gap="compact">
          <Button
            size="compact"
            onClick={() => actions.openResourceDetail(row.type, row.id)}
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

export function ResourceCatalogPageView({ state, actions }) {
  const filters = resourceFilterConfig("workflow-step", state, actions).map(
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
      <ResourceRow key={row.id} row={row} actions={actions} selected={false} />
    ))
  ) : (
    <EmptyState>No workflow steps match the current filters.</EmptyState>
  );

  return (
    <div className="page-surface resource-catalog-page">
      <header className="resource-catalog-page__header">
        <h1>Workflow steps</h1>
        <StepStrip
          steps={[
            { id: "model", label: "Model", description: "Select a model" },
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
      <section className="resource-catalog-grid">
        <Panel>
          <Stack gap="compact">
            <SampleFilterPanel
              filters={filters}
              actions={null}
              summary=""
              rows={rows}
              emptyState="No workflow steps are available."
              listClass="sample-picker file-sample-picker resource-catalog-picker"
            />
          </Stack>
        </Panel>
      </section>
      <ResourceCatalogOverlays state={state} actions={actions} />
    </div>
  );
}
