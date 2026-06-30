import { escapeHtml } from "../utils/html.js";

function renderFilterControl(filter) {
  const fieldAttrs = `data-filter-scope="${escapeHtml(filter.scope)}" data-filter-field="${escapeHtml(filter.field)}"`;

  if (filter.kind === "select") {
    const options = (filter.options || []).map((option) => `
      <option value="${escapeHtml(option.value)}" ${option.value === filter.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
    `).join("");

    return `
      <div class="field">
        <label for="${escapeHtml(filter.id)}">${escapeHtml(filter.label)}</label>
        <select id="${escapeHtml(filter.id)}" ${fieldAttrs} ${filter.disabled ? "disabled" : ""}>
          ${options}
        </select>
      </div>
    `;
  }

  return `
    <div class="field">
      <label for="${escapeHtml(filter.id)}">${escapeHtml(filter.label)}</label>
      <input id="${escapeHtml(filter.id)}" ${fieldAttrs}
        value="${escapeHtml(filter.value ?? "")}"
        ${filter.placeholder ? `placeholder="${escapeHtml(filter.placeholder)}"` : ""}
        ${filter.disabled ? "disabled" : ""} />
    </div>
  `;
}

export function renderSampleFilterPanel({
  filters = [],
  actions = "",
  summary = "",
  rows = "",
  emptyState = "No samples match the current filters.",
  listClass = "sample-picker",
  listAttributes = "",
}) {
  const filterRows = filters.map(renderFilterControl).join("");
  return `
    <div class="selection-summary">
      <div class="sample-filter-grid">${filterRows}</div>
      ${actions ? `<div class="inline-actions workflow-selection-actions">${actions}</div>` : ""}
      ${summary ? `<div class="count-label">${escapeHtml(summary)}</div>` : ""}
    </div>
    <div class="${escapeHtml(listClass)}" ${listAttributes}>${rows || `<div class="empty-state">${escapeHtml(emptyState)}</div>`}</div>
  `;
}
