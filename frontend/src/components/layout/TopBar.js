"use client";

import { NotificationBar } from "./NotificationBar.js";
import { useNotificationOverlay } from "./NotificationOverlay.js";

const prototypeNavItems = [
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Browse sample sets and workflows.",
  },
  {
    key: "file-management",
    title: "File Management",
    description: "Upload and group samples.",
  },
  {
    key: "workflow-workspace",
    title: "Workflow Workspace",
    description: "Run and inspect jobs.",
  },
  {
    key: "sample-set-analysis",
    title: "Analyze Sample Set",
    description: "Compare workflow results.",
  },
];

export function TopBar({
  loading,
  sampleCount,
  sampleSetCount = 0,
  prototypeNav,
  onCreateWorkflow,
  onNavigatePrototype,
}) {
  const notifications = useNotificationOverlay();
  const subtitle = loading ? "Loading data" : `sample_sets: ${sampleSetCount}, samples: ${sampleCount}`;

  function handlePrototypeNavClick(navKey) {
    onNavigatePrototype?.(navKey);
  }

  return (
    <header className="topbar">
      <div className="topbar-header">
        <div className="brand">
          <span className="brand-title">ScriptBench</span>
          <span className="brand-subtitle">{subtitle}</span>
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
        <div className="toolbar">
          <button className="btn-primary" type="button" onClick={onCreateWorkflow}>
            Create workflow
          </button>
        </div>
      </div>
      <nav className="prototype-nav" aria-label="Primary navigation">
        {prototypeNavItems.map((item) => (
          <button
            key={item.key}
            className={`prototype-nav-item ${prototypeNav === item.key ? "is-active" : ""}`}
            type="button"
            onClick={() => handlePrototypeNavClick(item.key)}
            aria-pressed={prototypeNav === item.key ? "true" : "false"}
          >
            <span className="prototype-nav-title">{item.title}</span>
            <span className="prototype-nav-description">{item.description}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
