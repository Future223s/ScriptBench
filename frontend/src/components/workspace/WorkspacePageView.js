"use client";

import { WorkspacePanel } from "./WorkspacePanel.js";
import { WorkspacePicker } from "./WorkspacePicker.js";
import { WorkspaceOverlays } from "./WorkspaceOverlays.js";

export function WorkspacePageView({ state, actions, rootRef }) {
  const hasSelectedWorkflow = state.selectedWorkflowId != null;
  return (
    <>
      <main className="workspace-page" ref={rootRef}>
        {hasSelectedWorkflow ? (
          <WorkspacePanel
            workflow={state.selectedWorkflowSummary}
            rows={state.rows}
            selection={state.selectedRowIdsByColumn}
            loading={state.loadingWorkspace || state.applyingExecutionAction}
            actions={actions}
          />
        ) : (
          <WorkspacePicker
            workflows={state.workflows}
            selectedWorkflowId={state.workspacePickerWorkflowId}
            loading={state.loadingWorkflows || state.loadingWorkspace || state.applyingExecutionAction}
            actions={actions}
          />
        )}
      </main>
      <WorkspaceOverlays state={state} actions={actions} />
    </>
  );
}
