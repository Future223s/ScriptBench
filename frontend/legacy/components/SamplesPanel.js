import { escapeHtml, truncate } from "../utils/html.js";
import { formatDate } from "../utils/date.js";
import { membershipsForSample, visibleSamples } from "../utils/workflow.js";

export function renderSamplesPanel({ samples, groupings, sampleQuery, sampleGroupFilter }) {
  const visible = visibleSamples(samples, groupings, sampleGroupFilter);
  const rows = visible.length
    ? visible.map((sample) => {
      const memberships = membershipsForSample(groupings, sample.sample_id);
      return `
        <button class="sample-row" data-action="open-sample" data-sample-id="${escapeHtml(sample.sample_id)}">
          <div class="sample-main">
            <strong>${escapeHtml(sample.sample_id)}</strong>
            <div class="meta-line">
              <span>${sample.has_sample_blob ? `${escapeHtml(sample.sample_blob_size)} bytes` : "No file"}</span>
              <span>${escapeHtml(formatDate(sample.updated_at))}</span>
              <span>${memberships.length} groups</span>
            </div>
            <p>${escapeHtml(truncate(sample.ground_truth_text))}</p>
          </div>
          <span class="badge ${sample.ground_truth_text ? "green" : ""}">
            ${sample.ground_truth_text ? "Ground truth" : "Empty"}
          </span>
        </button>
      `;
    }).join("")
    : `<div class="empty-state">No samples match the current filters.</div>`;

  return `
    <section class="panel samples-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Samples</h2>
          <span>Search, upload, and filter</span>
        </div>
        <div class="toolbar">
          <button class="btn-secondary" data-action="open-upload">Upload samples</button>
          <button class="btn-ghost" data-action="open-group">Create grouping</button>
        </div>
      </div>
      <div class="panel-header">
        <div class="sample-controls">
          <div class="field">
            <label for="sample-search">Search</label>
            <input id="sample-search" data-field="sample-query" value="${escapeHtml(sampleQuery)}" placeholder="Sample ID or text" />
          </div>
          <div class="field">
            <label for="sample-group-filter">Filter</label>
            <select id="sample-group-filter" data-field="sample-group-filter">
              <option value="">All groupings</option>
              ${groupings.map((group) => `
                <option value="${escapeHtml(group.name)}" ${group.name === sampleGroupFilter ? "selected" : ""}>${escapeHtml(group.name)}</option>
              `).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="samples-list">${rows}</div>
    </section>
  `;
}
