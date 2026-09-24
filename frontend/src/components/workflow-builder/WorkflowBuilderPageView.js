"use client";

import { EmptyState, Panel, Stack } from "../../ui/primitives/index.js";
import { WorkflowBuilderCanvas } from "./WorkflowBuilderCanvas.js";
import { WorkflowBuilderMetadataForm } from "./WorkflowBuilderMetadataForm.js";
import { WorkflowBuilderPageHeader } from "./WorkflowBuilderPageHeader.js";
import { WorkflowStepAssignmentModal } from "./WorkflowStepAssignmentModal.js";
import { WorkflowStepDetailModal } from "./WorkflowStepDetailModal.js";

export function WorkflowBuilderPageView({ state, actions }) {
  if (state.loading) {
    return (
      <main className="workflow-builder-page">
        <WorkflowBuilderPageHeader disabled saving={false} />
        <Panel>
          <EmptyState>Loading Workflow Builder...</EmptyState>
        </Panel>
      </main>
    );
  }

  return (
    <main className="workflow-builder-page">
      <WorkflowBuilderPageHeader
        saving={state.saving}
        finalizing={state.finalizing}
        disabled={state.saving || !state.workflowDraft.sample_set_id}
        finalizeDisabled={
          state.saving ||
          state.finalizing ||
          !state.selectedWorkflowId ||
          state.workflowDraft.status === "finalized"
        }
        workflows={state.workflows}
        selectedWorkflowId={state.selectedWorkflowId || ""}
        onSelectWorkflow={actions.selectWorkflow}
        onNewWorkflow={() => actions.selectWorkflow("")}
        onSave={actions.saveWorkflow}
        onFinalize={actions.finalizeWorkflow}
      />
      <div
        className="workflow-builder-grid"
        style={{ minHeight: "calc(100dvh - 190px)" }}
      >
        <aside className="workflow-builder-sidebar">
          <Stack>
            <WorkflowBuilderMetadataForm state={state} actions={actions} />
          </Stack>
        </aside>
        <section
          className="workflow-builder-workbench"
          style={{ minHeight: "calc(100dvh - 190px)" }}
        >
          <WorkflowBuilderCanvas state={state} actions={actions} />
        </section>
      </div>
      <WorkflowStepAssignmentModal state={state} actions={actions} />
      <WorkflowStepDetailModal state={state} actions={actions} />
    </main>
  );
}
