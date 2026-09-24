"use client";

import { EmptyState } from "../../ui/primitives/index.js";
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
        <section className="workflow-builder-loading">
          <EmptyState>Loading Workflow Builder...</EmptyState>
        </section>
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
      <WorkflowBuilderMetadataForm state={state} actions={actions} />
      <WorkflowBuilderCanvas state={state} actions={actions} />
      <WorkflowStepAssignmentModal state={state} actions={actions} />
      <WorkflowStepDetailModal state={state} actions={actions} />
    </main>
  );
}
