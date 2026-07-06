"use client";

import { WorkspacePageView } from "../../../components/workspace/WorkspacePageView.js";
import { useWorkspacePage } from "../../../hooks/workspace/useWorkspacePage.js";

export default function WorkspaceRoute() {
  const workspace = useWorkspacePage();

  return (
    <WorkspacePageView state={workspace.state} actions={workspace.actions} rootRef={workspace.rootRef} />
  );
}
