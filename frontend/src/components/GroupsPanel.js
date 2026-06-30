import { escapeHtml } from "../utils/html.js";
import { valuesForGrouping } from "../utils/workflow.js";

export function renderGroupsPanel({ groupings, selectedGroupName }) {
  const groupRows = groupings.length
    ? groupings.map((group) => {
      const values = valuesForGrouping(group);
      return `
        <button class="group-row ${group.name === selectedGroupName ? "is-selected" : ""}"
          data-action="open-group-detail"
          data-group-name="${escapeHtml(group.name)}">
          <span>
            <strong>${escapeHtml(group.name)}</strong>
            <span class="count-label">${values.length} values</span>
          </span>
          <span class="badge">${Object.keys(group.assignments || {}).length}</span>
        </button>
      `;
    }).join("")
    : `<div class="empty-state">No groupings yet.</div>`;

  return `
    <section class="panel groups-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Groupings</h2>
          <span>Open a grouping detail page</span>
        </div>
      </div>
      <div class="group-list padded-list">${groupRows}</div>
    </section>
  `;
}
