"use client";

import { WorkspacePanel } from "./WorkspacePanel.js";
import { WorkspaceOverlays } from "./WorkspaceOverlays.js";

export function WorkspacePageView({ state, actions, rootRef }) {
  return (
    <>
      <main className="workspace-page" ref={rootRef}>
        <WorkspacePanel
          workflows={state.workflows}
          selectedWorkflowId={state.selectedWorkflowId}
          workflow={state.selectedWorkflowSummary}
          graph={state.executionGraph}
          selectedNodeId={state.selectedExecutionNodeId}
          rows={state.rows}
          selection={state.selectedRowIdsByColumn}
          loading={state.loadingWorkflows || state.loadingWorkspace || state.applyingExecutionAction}
          actions={actions}
        />
      </main>
      <WorkspaceOverlays state={state} actions={actions} />
    </>
  );
}
