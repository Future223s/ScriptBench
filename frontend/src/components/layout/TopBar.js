"use client";

import { DevControls } from "./DevControls.js";
import { NotificationBar } from "./NotificationBar.js";
import { useNotificationOverlay } from "./NotificationOverlay.js";
import { PrimaryNavigation } from "../../ui/primitives/index.js";

const primaryNavItems = [
  {
    id: "dashboard",
    label: "Dashboard",
  },
  {
    id: "file-management",
    label: "File Management",
  },
  {
    id: "workflow-steps",
    label: "Workflow Steps",
  },
  {
    id: "workflow-builder",
    label: "Workflow Builder",
  },
  {
    id: "workflow-workspace",
    label: "Workspace",
  },
  {
    id: "analysis",
    label: "Analysis",
  },
];

export function TopBar({ prototypeNav, onNavigatePrototype }) {
  const notifications = useNotificationOverlay();

  return (
    <header className="topbar">
      <div className="topbar-header">
        <div className="brand">
          <span className="brand-title">ScriptBench</span>
        </div>
        <div
          className="topbar-notification-slot"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="topbar-notification-stack">
            {(notifications?.notifications || []).map((notification) => (
              <NotificationBar
                key={notification.id}
                kind={notification.kind}
                message={notification.message}
                role={notification.kind === "error" ? "alert" : "status"}
              />
            ))}
          </div>
        </div>
        <DevControls />
      </div>
      <PrimaryNavigation
        items={primaryNavItems}
        activeId={prototypeNav}
        onChange={onNavigatePrototype}
      />
    </header>
  );
}
