import { escapeHtml } from "../../utils/html.js";

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
    key: "workflow-workspace",
    title: "Workspace",
  },
  {
    key: "analysis",
    title: "Analysis",
    disabled: true,
  },
];

export function renderTopBar({ prototypeNav }) {
  return `
      <header class="topbar">
      <div class="topbar-header">
        <div class="brand">
          <span class="brand-title">${escapeHtml("ScriptBench")}</span>
        </div>
      </div>
      <nav class="prototype-nav" aria-label="Primary navigation">
        ${prototypeNavItems.map((item) => `
          <button
            class="prototype-nav-item ${prototypeNav === item.key ? "is-active" : ""}"
            type="button"
            ${item.disabled ? 'disabled title="Coming soon" aria-disabled="true"' : `data-action="prototype-nav" data-nav-key="${escapeHtml(item.key)}"`}
            ${prototypeNav === item.key ? 'aria-current="page"' : ""}
          >
            <span class="prototype-nav-title">${escapeHtml(item.title)}</span>
          </button>
        `).join("")}
      </nav>
    </header>
  `;
}
