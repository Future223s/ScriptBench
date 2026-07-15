"use client";

import { NotificationBar } from "./NotificationBar.js";
import { useNotificationOverlay } from "./NotificationOverlay.js";

const prototypeNavItems = [
  {
    key: "dashboard",
    title: "Dashboard",
  },
  {
    key: "workflow-builder",
    title: "Workflow Builder",
  },
  {
    key: "file-management",
    title: "File Management",
  },
  {
    key: "resources",
    title: "Resources",
  },
  {
    key: "workflow-workspace",
    title: "Workspace",
  },
  {
    key: "analysis",
    title: "Analysis",
    disabled: true,
  },
];

export function TopBar({
  prototypeNav,
  onNavigatePrototype,
}) {
  const notifications = useNotificationOverlay();

  function handlePrototypeNavClick(navKey) {
    onNavigatePrototype?.(navKey);
  }

  return (
    <header className="topbar">
      <div className="topbar-header">
        <div className="brand">
          <span className="brand-title">ScriptBench</span>
        </div>
        <div className="topbar-notification-slot" aria-live="polite" aria-atomic="true">
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
      </div>
      <nav className="prototype-nav" aria-label="Primary navigation">
        {prototypeNavItems.map((item) => (
          <button
            key={item.key}
            className={`prototype-nav-item ${prototypeNav === item.key ? "is-active" : ""}`}
            type="button"
            onClick={item.disabled ? undefined : () => handlePrototypeNavClick(item.key)}
            aria-current={prototypeNav === item.key ? "page" : undefined}
            aria-disabled={item.disabled ? "true" : undefined}
            disabled={item.disabled}
            title={item.disabled ? "Coming soon" : undefined}
          >
            <span className="prototype-nav-title">{item.title}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
