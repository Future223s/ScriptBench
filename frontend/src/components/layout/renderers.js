import { escapeHtml } from "../../utils/html.js";

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

export function renderTopBar({ loading, sampleCount, sampleSetCount = 0, prototypeNav }) {
  const subtitle = loading ? "Loading data" : `sample_sets: ${sampleSetCount}, samples: ${sampleCount}`;
  return `
      <header class="topbar">
      <div class="topbar-header">
        <div class="brand">
          <span class="brand-title">${escapeHtml("ScriptBench")}</span>
          <span class="brand-subtitle">${escapeHtml(subtitle)}</span>
        </div>
        <div class="toolbar">
          <button class="btn-primary" data-action="open-workflow">Create workflow</button>
        </div>
      </div>
      <nav class="prototype-nav" aria-label="Primary navigation">
        ${prototypeNavItems.map((item) => `
          <button
            class="prototype-nav-item ${prototypeNav === item.key ? "is-active" : ""}"
            type="button"
            data-action="prototype-nav"
            data-nav-key="${escapeHtml(item.key)}"
            aria-pressed="${prototypeNav === item.key ? "true" : "false"}"
          >
            <span class="prototype-nav-title">${escapeHtml(item.title)}</span>
            <span class="prototype-nav-description">${escapeHtml(item.description)}</span>
          </button>
        `).join("")}
      </nav>
    </header>
  `;
}
