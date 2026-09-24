"use client";

import { useEffect, useState } from "react";
import { DevControls } from "./DevControls.js";
import { NotificationBar } from "./NotificationBar.js";
import { useNotificationOverlay } from "./NotificationOverlay.js";
import { Icon, PrimaryNavigation } from "../../ui/primitives/index.js";

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
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setNavigationOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

  function navigate(itemId) {
    setNavigationOpen(false);
    onNavigatePrototype?.(itemId);
  }

  return (
    <aside className="topbar">
      <div className="topbar-header">
        <div className="brand">
          <span className="brand-title">ScriptBench</span>
        </div>
        <button
          type="button"
          className="topbar-menu-toggle"
          aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
          aria-controls="primary-sidebar-navigation"
          aria-expanded={navigationOpen}
          onClick={() => setNavigationOpen((current) => !current)}
        >
          <Icon name={navigationOpen ? "close" : "menu"} />
        </button>
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
      <div
        id="primary-sidebar-navigation"
        className={`topbar-navigation${navigationOpen ? " is-open" : ""}`}
      >
        <PrimaryNavigation
          items={primaryNavItems}
          activeId={prototypeNav}
          onChange={navigate}
          orientation="vertical"
        />
        <div className="topbar-footer">
          <DevControls />
        </div>
      </div>
      {navigationOpen ? (
        <button
          type="button"
          className="topbar-navigation-scrim"
          aria-label="Close navigation"
          onClick={() => setNavigationOpen(false)}
        />
      ) : null}
    </aside>
  );
}
