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
            workspace={state.workspace}
            loading={state.workspaceLoading}
            activePane={state.workspacePane}
            transcriptionSet={state.workspaceTranscriptionSet}
            jobSelection={state.workspaceJobSelection}
            reviewQuery={state.workspaceReviewQuery}
            reviewSort={state.workspaceReviewSort}
            selectedTranscriptionId={state.selectedWorkspaceTranscriptionId}
            selectedTranscription={state.selectedWorkspaceTranscription}
            reviewCompareExpanded={state.workspaceReviewCompareExpanded}
            actions={actions}
          />
        ) : (
          <WorkspacePicker
            workflows={state.workflows}
            selectedWorkflowId={state.workspacePickerWorkflowId}
            loading={state.loading || state.workspaceLoading}
            actions={actions}
          />
        )}
      </main>
      <WorkspaceOverlays state={state} actions={actions} />
    </>
  );
}
