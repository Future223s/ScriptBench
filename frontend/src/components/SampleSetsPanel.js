import { escapeHtml } from "../utils/html.js";

function renderTrashIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7h15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
}

function formatMetricValue(value) {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return Number(value).toFixed(3);
}

function getMetricTone(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("cer")) return "cer";
  if (normalized.includes("wer")) return "wer";
  return "hallucinations";
}

function renderIconGlyph(kind) {
  const icons = {
    sampleSets: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 16.5c2.2 0 3.6-1.3 4.8-3s2.6-3 4.8-3 2.6 1.3 3.8 3 2.6 3 4.6 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5.5 19.5h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="6" cy="8" r="1.2" fill="currentColor"/>
        <path d="M17 6.5l1.6 1.6 3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    sampleSet: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14M5 12h14M5 16h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M7 4.8 4 6.4v10.8l3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V6.4l-3-1.6-3 1.6-3-1.6-3 1.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>`,
    workflows: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <rect x="16" y="4" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <rect x="9.5" y="15" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M5.5 9.5v3.1c0 1.1.9 2 2 2h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M18.5 9.5v3.1c0 1.1-.9 2-2 2h-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
    samples: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6.5h10a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H8.5L4 21V8.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M8 11h8M8 14h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
    cer: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 15.5c2.6 0 3.7-2 5-4.1 1.2-2 2.6-4 5.2-4s3.6 1.6 5.8 3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 18h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="8" cy="8" r="1.1" fill="currentColor"/>
      </svg>`,
    wer: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H13l-4.2 3v-3H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M8 10h8M8 13h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
    hallucinations: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5 14.8 8l4.2.7-2.7 3.3.6 4.2-4-1.8-3.9 1.8.5-4.2L6.8 8.7 11 8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>`,
    arrow: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    chevron: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    trash: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 7h15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
  };

  return icons[kind] || "";
}

function renderIconBadge(kind, extraClass = "") {
  return `<span class="icon-badge ${extraClass}" aria-hidden="true">${renderIconGlyph(kind)}</span>`;
}

function renderMetricWidget(label, value, tone) {
  return `
    <div class="metric-bubble ${tone}">
      ${renderIconBadge(tone, "metric-icon")}
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatMetricValue(value))}</strong>
      </div>
    </div>
  `;
}

function formatWorkflowMeta(workflow) {
  const stage = workflow.workflow_stage || workflow.stage || "n/a";
  const modelFamily = workflow.model_family || "n/a";
  const model = workflow.model || "n/a";
  return `${stage} | ${modelFamily} | ${model}`;
}

function renderSampleSetCards({
  sampleSets,
  selectedSampleSetId,
  showDelete = true,
}) {
  return sampleSets.length
    ? sampleSets.map((sampleSet) => `
      <div class="workflow-card ${Number(sampleSet.sample_set_id) === Number(selectedSampleSetId) ? "is-selected" : ""}"
        data-action="select-sample-set"
        title="View sample set analytics"
        data-sample-set-id="${escapeHtml(sampleSet.sample_set_id)}">
        ${renderIconBadge("sampleSet", "workflow-icon")}
        <div class="workflow-card-body">
          <strong>${escapeHtml(sampleSet.sample_set_name)}</strong>
          <div class="meta-line sample-set-meta-line">
            <span class="badge">${escapeHtml(sampleSet.sample_count || 0)} samples</span>
            <span class="badge amber">${escapeHtml(sampleSet.workflow_count || 0)} workflows</span>
          </div>
        </div>
        <div class="workflow-card-actions">
          ${showDelete ? `<button class="btn-danger btn-tight icon-delete-button" type="button" data-action="delete-sample-set" data-sample-set-id="${escapeHtml(sampleSet.sample_set_id)}" aria-label="Delete sample set ${escapeHtml(sampleSet.sample_set_name)}" title="Delete sample set">${renderTrashIcon()}</button>` : ""}
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">No sample sets yet.</div>`;
}

function renderMetricPill(label, value, tone) {
  return renderMetricWidget(label, value, tone);
}

function renderMetricCard(label, metric) {
  const tone = getMetricTone(label);
  if (!metric) {
    return `
      <article class="detail-card analytics-metric-card ${tone}">
        <div class="analytics-metric-heading">
          ${renderIconBadge(tone, "metric-card-icon")}
          <h3>${escapeHtml(label)}</h3>
        </div>
        <div class="analytics-empty analytics-empty-centered">
          ${renderIconBadge("sampleSet", "empty-widget-icon")}
          <span>No values available yet.</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="detail-card analytics-metric-card ${tone}">
      <div class="analytics-metric-heading">
        ${renderIconBadge(tone, "metric-card-icon")}
        <h3>${escapeHtml(label)}</h3>
      </div>
      <div class="metric-bubble-row">
        ${renderMetricPill("Min", metric.min, "min")}
        ${renderMetricPill("Median", metric.median, "median")}
        ${renderMetricPill("Max", metric.max, "max")}
      </div>
    </article>
  `;
}

function renderWorkflowMiniCard(workflow) {
  return `
    <div class="analytics-mini-card analytics-mini-workflow-card">
      <div class="analytics-mini-copy">
        <strong>${escapeHtml(workflow.workflow_name || `Workflow ${workflow.workflow_id}`)}</strong>
        <span>${escapeHtml(formatWorkflowMeta(workflow))}</span>
      </div>
      <button
        class="btn-danger btn-tight icon-delete-button analytics-mini-delete-button"
        type="button"
        data-action="delete-workflow"
        data-workflow-id="${escapeHtml(workflow.workflow_id)}"
        aria-label="Delete workflow ${escapeHtml(workflow.workflow_name || workflow.workflow_id)}"
        title="Delete workflow"
      >
        ${renderTrashIcon()}
      </button>
    </div>
  `;
}

function renderSampleMiniCard(sampleId) {
  return `
    <div class="analytics-mini-card">
      <strong>${escapeHtml(sampleId)}</strong>
    </div>
  `;
}

function renderAnalyticsLoadingState() {
  return `
    <section class="sample-set-analytics-shell analytics-loading-shell" aria-busy="true" aria-live="polite">
      <section class="detail-card sample-set-summary-card analytics-summary-skeleton">
        <div class="sample-set-summary-top">
          <div class="sample-set-summary-heading">
            ${renderIconBadge("sampleSets", "summary-icon")}
            <div class="sample-set-summary-copy">
              <div class="eyebrow">Sample set analytics</div>
              <div class="skeleton-line skeleton-line-title"></div>
              <div class="skeleton-line skeleton-line-subtitle"></div>
            </div>
          </div>
          <div class="summary-chip-row">
            <span class="summary-chip skeleton-chip">
              ${renderIconBadge("workflows", "summary-chip-icon")}
              <span class="summary-chip-copy">
                <span class="skeleton-line skeleton-line-value"></span>
                <span class="skeleton-line skeleton-line-label"></span>
              </span>
            </span>
            <span class="summary-chip skeleton-chip">
              ${renderIconBadge("samples", "summary-chip-icon")}
              <span class="summary-chip-copy">
                <span class="skeleton-line skeleton-line-value"></span>
                <span class="skeleton-line skeleton-line-label"></span>
              </span>
            </span>
          </div>
        </div>
      </section>

      <details class="analytics-accordion" open>
        <summary>
          <span class="accordion-title">
            ${renderIconBadge("cer", "accordion-icon")}
            <span>Metrics</span>
          </span>
          <span class="accordion-meta">
            <span class="count-label">CER, WER, Hallucinations</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-metric-grid">
          ${["cer", "wer", "hallucinations"].map((tone) => `
            <article class="detail-card analytics-metric-card ${tone} analytics-skeleton-card">
              <div class="analytics-metric-heading">
                ${renderIconBadge(tone, "metric-card-icon")}
                <span class="skeleton-line skeleton-line-title"></span>
              </div>
              <div class="metric-bubble-row">
                <div class="metric-bubble skeleton-bubble">
                  ${renderIconBadge(tone, "metric-icon")}
                  <div>
                    <span class="skeleton-line skeleton-line-label"></span>
                    <strong class="skeleton-line skeleton-line-value"></strong>
                  </div>
                </div>
                <div class="metric-bubble skeleton-bubble">
                  ${renderIconBadge(tone, "metric-icon")}
                  <div>
                    <span class="skeleton-line skeleton-line-label"></span>
                    <strong class="skeleton-line skeleton-line-value"></strong>
                  </div>
                </div>
                <div class="metric-bubble skeleton-bubble">
                  ${renderIconBadge(tone, "metric-icon")}
                  <div>
                    <span class="skeleton-line skeleton-line-label"></span>
                    <strong class="skeleton-line skeleton-line-value"></strong>
                  </div>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      </details>

      <details class="analytics-accordion">
        <summary>
          <span class="accordion-title"><span>Workflows</span></span>
          <span class="accordion-meta">
            <span class="count-label">Loading...</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-mini-list analytics-mini-list-skeleton">
          ${Array.from({ length: 3 }).map(() => `
            <div class="analytics-mini-card analytics-skeleton-card">
              <span class="skeleton-line skeleton-line-title"></span>
              <span class="skeleton-line skeleton-line-subtitle"></span>
            </div>
          `).join("")}
        </div>
      </details>

      <details class="analytics-accordion">
        <summary>
          <span class="accordion-title"><span>Samples</span></span>
          <span class="accordion-meta">
            <span class="count-label">Loading...</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-mini-list analytics-mini-list-skeleton">
          ${Array.from({ length: 4 }).map(() => `
            <div class="analytics-mini-card analytics-skeleton-card">
              <span class="skeleton-line skeleton-line-title"></span>
            </div>
          `).join("")}
        </div>
      </details>
    </section>
  `;
}

function renderSelectedSampleSetAnalytics(sampleSetAnalytics, sampleSet) {
  if (!sampleSetAnalytics) {
    return `<div class="analytics-empty">Select a sample set to view analytics.</div>`;
  }

  const selectedSampleSet = sampleSet || sampleSetAnalytics.sample_set || {};
  const metrics = sampleSetAnalytics.metrics || {};
  const workflowRows = sampleSetAnalytics.workflows || [];
  const sampleIds = sampleSetAnalytics.sample_ids || selectedSampleSet.sample_ids || [];
  const workflowCount = Number(selectedSampleSet.workflow_count ?? sampleSetAnalytics.workflow_count ?? workflowRows.length ?? 0);
  const sampleCount = Number(selectedSampleSet.sample_count ?? sampleIds.length ?? 0);
  const groupingNames = Array.from(
    new Set(
      workflowRows.flatMap((workflow) =>
        Array.isArray(workflow?.groups)
          ? workflow.groups.map((group) => String(group).trim()).filter(Boolean)
          : [],
      ),
    ),
  );
  const groupingLabel = groupingNames.length ? groupingNames.join(", ") : "none";

  return `
    <section class="sample-set-analytics-shell">
      <section class="detail-card sample-set-summary-card">
        <div class="sample-set-summary-top">
          <div class="sample-set-summary-heading">
            ${renderIconBadge("sampleSets", "summary-icon")}
            <div class="sample-set-summary-copy">
              <div class="eyebrow">Sample set analytics</div>
              <h3>${escapeHtml(selectedSampleSet.sample_set_name || "Sample set")}</h3>
            </div>
          </div>
          <div class="summary-chip-row">
            <span class="summary-chip">
              ${renderIconBadge("workflows", "summary-chip-icon")}
              <span class="summary-chip-copy">
                <strong>${escapeHtml(workflowCount)}</strong>
                <span>workflows</span>
              </span>
            </span>
            <span class="summary-chip" title="${escapeHtml(groupingLabel)}">
              ${renderIconBadge("sampleSet", "summary-chip-icon")}
              <span class="summary-chip-copy">
                <strong>${escapeHtml(groupingNames.length)}</strong>
                <span>${escapeHtml(groupingNames.length === 1 ? "grouping" : "groupings")}${groupingNames.length ? `: ${escapeHtml(groupingLabel)}` : ""}</span>
              </span>
            </span>
            <span class="summary-chip">
              ${renderIconBadge("samples", "summary-chip-icon")}
              <span class="summary-chip-copy">
                <strong>${escapeHtml(sampleCount)}</strong>
                <span>samples</span>
              </span>
            </span>
          </div>
        </div>
      </section>

      <details class="analytics-accordion" open>
        <summary>
          <span class="accordion-title">
            ${renderIconBadge("cer", "accordion-icon")}
            <span>Metrics</span>
          </span>
          <span class="accordion-meta">
            <span class="count-label">CER, WER, Hallucinations</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-metric-grid">
          ${renderMetricCard("CER", metrics.cer)}
          ${renderMetricCard("WER", metrics.wer)}
          ${renderMetricCard("Hallucinations", metrics.hallucinations)}
        </div>
      </details>

      <details class="analytics-accordion">
        <summary>
          <span class="accordion-title"><span>Workflows</span></span>
          <span class="accordion-meta">
            <span class="count-label">${escapeHtml(workflowRows.length)} items</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-mini-list">
          ${workflowRows.length
            ? workflowRows.map((workflow) => renderWorkflowMiniCard(workflow)).join("")
            : `<div class="analytics-empty">No workflows are attached to this sample set yet.</div>`}
        </div>
      </details>

      <details class="analytics-accordion">
        <summary>
          <span class="accordion-title"><span>Samples</span></span>
          <span class="accordion-meta">
            <span class="count-label">${escapeHtml(sampleIds.length)} items</span>
            ${renderIconBadge("chevron", "accordion-chevron")}
          </span>
        </summary>
        <div class="analytics-mini-list">
          ${sampleIds.length
            ? sampleIds.map((sampleId) => renderSampleMiniCard(sampleId)).join("")
            : `<div class="analytics-empty">No samples are attached to this sample set yet.</div>`}
        </div>
      </details>
    </section>
  `;
}

export function renderSampleSetAnalyticsPanel({
  workflow,
  sampleSet,
  sampleSetAnalytics,
  analyticsLoading = false,
  analyticsError = "",
}) {
  return `
    <section class="panel sample-set-analytics-panel">
      ${analyticsError
        ? `<div class="error-banner">${escapeHtml(analyticsError)}</div>`
        : analyticsLoading
          ? renderAnalyticsLoadingState()
          : sampleSetAnalytics
            ? renderSelectedSampleSetAnalytics(sampleSetAnalytics, sampleSet)
            : `<div class="analytics-empty">${workflow ? "No analytics available for this sample set." : "Click a sample set to view analytics."}</div>`}
    </section>
  `;
}

export function renderSampleSetsPanel({
  sampleSets,
  selectedSampleSetId,
}) {
  return `
    <section class="panel sample-sets-panel">
      <div class="panel-header">
        <div class="panel-title panel-title-widget">
        
          <div class="panel-title-copy">
            <h2>Sample sets</h2>
            <span>These sets now anchor workflows and analytics</span>
          </div>
        </div>
        <span class="badge badge-stack">
          ${renderIconBadge("sampleSet", "badge-icon")}
          <span class="badge-stack-copy">
            <strong>${escapeHtml(sampleSets.length)}</strong>
            <span>sets</span>
          </span>
        </span>
      </div>
      <div class="workflow-list">${renderSampleSetCards({ sampleSets, selectedSampleSetId, showDelete: true })}</div>
    </section>
  `;
}

export { renderSampleSetCards };
