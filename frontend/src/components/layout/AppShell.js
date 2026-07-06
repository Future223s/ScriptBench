"use client";

import { WorkflowCreationHost } from "../workflow/WorkflowCreationHost.js";
import { AppShellContent } from "./AppShellContent.js";
import { NotificationOverlayProvider } from "./NotificationOverlay.js";

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <NotificationOverlayProvider>
        <WorkflowCreationHost>
          <AppShellContent>{children}</AppShellContent>
        </WorkflowCreationHost>
      </NotificationOverlayProvider>
    </div>
  );
}
