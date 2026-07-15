"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { WorkflowBuilderCanvas } from "./WorkflowBuilderCanvas.js";
import { WorkflowBuilderMetadataForm } from "./WorkflowBuilderMetadataForm.js";
import { WorkflowBuilderPageHeader } from "./WorkflowBuilderPageHeader.js";
import { WorkflowStepAssignmentModal } from "./WorkflowStepAssignmentModal.js";
import { WorkflowStepCreationWizardModal } from "./WorkflowStepCreationWizardModal.js";
import { WorkflowStepDetailModal } from "./WorkflowStepDetailModal.js";

export function WorkflowBuilderPageView({ state, actions }) {
  if (state.loading) {
    return (
      <div className="page-surface workflow-builder-page">
        <WorkflowBuilderPageHeader disabled saving={false} />
        <Panel>
          <EmptyState>Loading Workflow Builder...</EmptyState>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page-surface workflow-builder-page">
      <WorkflowBuilderPageHeader
        saving={state.saving}
        disabled={state.saving || !state.workflowDraft.sample_set_id}
        onSave={actions.saveWorkflow}
      />
      <div className="workflow-builder-grid">
        <aside className="workflow-builder-sidebar">
          <WorkflowBuilderMetadataForm state={state} actions={actions} />
        </aside>
        <section className="workflow-builder-workbench">
          <WorkflowBuilderCanvas state={state} actions={actions} />
        </section>
      </div>
      <WorkflowStepAssignmentModal state={state} actions={actions} />
      <WorkflowStepCreationWizardModal state={state} actions={actions} />
      <WorkflowStepDetailModal state={state} actions={actions} />
    </div>
  );
}
