import { escapeHtml, truncate } from "../utils/html.js";
import { formatDate } from "../utils/date.js";

const PANES = [
  {
    key: "jobs",
    title: "Jobs",
    description: "Monitor pending, queued, and completed jobs.",
  },
  {
    key: "assembly",
    title: "Assembly",
    description: "Assemble and score transcriptions.",
  },
  {
    key: "review",
    title: "Review",
    description: "Search, sort, and inspect outputs.",
  },
];

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMetric(value) {
  const number = asNumber(value);
  return number == null ? "n/a" : number.toFixed(3);
}

function toneForMetric(value) {
  const number = asNumber(value);
  if (number == null) return "neutral";
  if (number <= 0.1) return "good";
  if (number <= 0.25) return "warn";
  return "bad";
}

function workflowStageLabel(workspace) {
  return workspace?.workflow?.workflow_stage || workspace?.workflow?.stage || "Stage";
}

function sampleSetLabel(workspace) {
  return workspace?.workflow?.sample_set_id ?? "n/a";
}

function transcriptionOutputName(transcription) {
  const explicit = String(transcription?.output_name || "").trim();
  if (explicit) return explicit;

  const groupName = String(transcription?.group_name || "").trim();
  const groupValue = String(transcription?.group_value || "").trim();
  if (groupName && groupValue) return `${groupName}: ${groupValue}`;

  if (Array.isArray(transcription?.sample_ids) && transcription.sample_ids.length === 1) {
    return transcription.sample_ids[0];
  }
  if (Array.isArray(transcription?.sample_ids) && transcription.sample_ids.length > 1) {
    return `${transcription.sample_ids[0]} + ${transcription.sample_ids.length - 1} more`;
  }

  return transcription?.sample_id || `Output ${transcription?.transcription_id || ""}`;
}

function transcriptionSearchText(transcription) {
  return [
    transcriptionOutputName(transcription),
    transcription?.sample_id,
    Array.isArray(transcription?.sample_ids) ? transcription.sample_ids.join(" ") : "",
    transcription?.group_name,
    transcription?.group_value,
    transcription?.transcription_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function transcriptionScore(transcription) {
  const cer = asNumber(transcription?.cer);
  const wer = asNumber(transcription?.wer);
  if (cer == null && wer == null) return Number.POSITIVE_INFINITY;
  if (cer == null) return wer;
  if (wer == null) return cer;
  return (cer + wer) / 2;
}

function aggregateMetrics(transcriptions) {
  const buckets = {
    cer: [],
    wer: [],
    hallucinations: [],
    line_omission_count: [],
    line_addition_count: [],
  };

  for (const transcription of transcriptions) {
    for (const key of Object.keys(buckets)) {
      const value = asNumber(transcription?.[key]);
      if (value != null) buckets[key].push(value);
    }
  }

  const result = {};
  for (const [key, values] of Object.entries(buckets)) {
    if (!values.length) continue;
    const total = values.reduce((sum, value) => sum + value, 0);
    result[key] = {
      mean: total / values.length,
      count: values.length,
    };
  }
  return result;
}

function sortTranscriptions(transcriptions, sortKey) {
  const items = [...transcriptions];
  items.sort((left, right) => {
    if (sortKey === "created_at") {
      return String(right.created_at || "").localeCompare(String(left.created_at || ""));
    }
    if (sortKey === "sample_id") {
      return String(transcriptionOutputName(left)).localeCompare(String(transcriptionOutputName(right)));
    }
    const leftScore = transcriptionScore(left);
    const rightScore = transcriptionScore(right);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return String(transcriptionOutputName(left)).localeCompare(String(transcriptionOutputName(right)));
  });
  return items;
}

function filterTranscriptions(transcriptions, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return transcriptions;
  return transcriptions.filter((transcription) => transcriptionSearchText(transcription).includes(normalized));
}

function selectedTranscription(transcriptions, selectedTranscriptionId) {
  return (
    transcriptions.find((item) => Number(item.transcription_id) === Number(selectedTranscriptionId))
    || transcriptions[0]
    || null
  );
}

function selectedJobIds(selection, key) {
  return Array.isArray(selection?.[key]) ? selection[key] : [];
}

function renderPaneButton({ activePane, pane }) {
  return `
    <button class="workspace-stage-card ${activePane === pane.key ? "is-active" : ""}" type="button"
      data-action="workspace-pane" data-workspace-pane="${escapeHtml(pane.key)}"
      aria-pressed="${activePane === pane.key ? "true" : "false"}">
      <span class="workspace-stage-card-title">${escapeHtml(pane.title)}</span>
      <span class="workspace-stage-card-description">${escapeHtml(pane.description)}</span>
    </button>
  `;
}

function renderMetricChip(label, value) {
  return `
    <span class="metric-chip ${toneForMetric(value)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatMetric(value))}</strong>
    </span>
  `;
}

function renderMetricTile(label, value, caption, tone = "neutral") {
  const number = asNumber(value);
  const displayValue = number == null ? "n/a" : Number.isInteger(number) ? String(number) : number.toFixed(3);
  return `
    <div class="metric-tile ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(displayValue)}</strong>
      <small>${escapeHtml(caption || "No scores yet")}</small>
    </div>
  `;
}

function renderJobCard(job, kind, selection) {
  const selected = selectedJobIds(selection, kind).includes(Number(job.job_id));
  const sampleIds = Array.isArray(job.sample_ids) ? job.sample_ids.map((sampleId) => String(sampleId)).filter(Boolean) : [];
  const samplePreview = sampleIds.length ? sampleIds.join(", ") : "No sample ids";
  const status = String(job.status || kind || "pending").toLowerCase();
  const statusLabel = status === "running"
    ? "running..."
    : status === "queued"
      ? "queued"
      : status === "completed"
        ? "completed"
        : status === "failed"
          ? "failed"
          : "";
  const statusTone = status === "running" ? "amber" : status === "completed" ? "green" : status === "failed" ? "amber" : "";
  const statusMessage = status === "running"
    ? "Model request sent."
    : status === "completed"
      ? "Transcription completed."
      : status === "failed"
        ? String(job.failure_reason || "Transcription failed.")
        : status === "queued"
          ? "Waiting for the worker."
          : "";

  return `
    <article class="workspace-job-card ${kind} status-${status} ${selected ? "is-selected" : ""}">
      <button class="workspace-job-main" type="button" data-action="open-job" data-job-id="${escapeHtml(job.job_id)}">
        <label class="workspace-job-select" title="${selected ? "Unselect job" : "Select job"}">
          <input type="checkbox" data-action="toggle-workspace-job" data-job-status="${escapeHtml(kind)}" data-job-id="${escapeHtml(job.job_id)}" ${selected ? "checked" : ""} />
          <span class="workspace-job-check" aria-hidden="true">${selected ? "✓" : ""}</span>
        </label>
        <strong>Job ${escapeHtml(job.job_id)}</strong>
        <span class="workspace-job-date">${escapeHtml(formatDate(job.created_at))}</span>
        <p class="workspace-job-preview">${escapeHtml(samplePreview)}</p>
        ${statusMessage ? `<p class="workspace-job-message">${escapeHtml(statusMessage)}</p>` : ""}
      </button>
    </article>
  `;
}

function renderJobPanel({ kind, title, description, jobs, selection, primaryAction }) {
  const selectedCount = selectedJobIds(selection, kind).length;
  const allSelected = jobs.length > 0 && selectedCount === jobs.length;
  const cards = jobs.length
    ? jobs.map((job) => renderJobCard(job, kind, selection)).join("")
    : `<div class="empty-state">No ${escapeHtml(title.toLowerCase())} yet.</div>`;

  return `
    <section class="panel workspace-job-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>${escapeHtml(title)}</h2>
          <span>${escapeHtml(description)}</span>
        </div>
      </div>
      <div class="workspace-panel-toolbar">
        <button class="btn-${allSelected ? "secondary" : "ghost"} btn-tight" type="button" data-action="select-visible-workspace-jobs" data-job-status="${escapeHtml(kind)}" aria-pressed="${allSelected ? "true" : "false"}">${allSelected ? "Unselect all" : "Select all"}</button>
        <button class="btn-primary btn-tight" type="button" data-action="${escapeHtml(primaryAction)}" ${selectedCount ? "" : "disabled"}>${kind === "completed" ? "Retry selected" : kind === "queued" ? "Unqueue selected" : "Queue selected"}</button>
      </div>
      <div class="workspace-job-list" data-preserve-scroll-key="workspace-job-list-${escapeHtml(kind)}">${cards}</div>
    </section>
  `;
}

function renderComparisonPane(workspace) {
  const workflow = workspace?.workflow || {};
  const sampleCount = Array.isArray(workspace?.samples) ? workspace.samples.length : 0;
  const pendingCount = Array.isArray(workspace?.pending_jobs) ? workspace.pending_jobs.length : 0;
  const queuedCount = Array.isArray(workspace?.queued_jobs) ? workspace.queued_jobs.length : 0;
  const completedCount = Array.isArray(workspace?.completed_jobs) ? workspace.completed_jobs.length : 0;
  const transcriptionCount = Array.isArray(workspace?.transcriptions) ? workspace.transcriptions.length : 0;

  return `
    <section class="workspace-comparison-grid">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>${escapeHtml(workflow.workflow_name || "Workflow workspace")}</h2>
            <span>${escapeHtml(workflowStageLabel(workspace))} | sample set ${escapeHtml(sampleSetLabel(workspace))}</span>
          </div>
          <button class="btn-primary" type="button" data-action="workspace-pane" data-workspace-pane="jobs">Open stage view</button>
        </div>
        <div class="workspace-summary-grid">
          ${renderMetricTile("Samples", sampleCount, "Attached to the workspace", "neutral")}
          ${renderMetricTile("Pending jobs", pendingCount, `${pendingCount} waiting to queue`, "amber")}
          ${renderMetricTile("Queued jobs", queuedCount, `${queuedCount} in flight or waiting`, "amber")}
          ${renderMetricTile("Completed jobs", completedCount, `${completedCount} ready for retry`, "good")}
          ${renderMetricTile("Transcriptions", transcriptionCount, `${transcriptionCount} reviewable outputs`, "good")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Within workflow</h2>
            <span>Mock compare space for current stage</span>
          </div>
          <span class="badge green">Primary</span>
        </div>
        <div class="workspace-comparison-card">
          <strong>${escapeHtml(workflow.workflow_stage || "Stage")}</strong>
          <p>${escapeHtml(workflow.workflow_name || "")}</p>
          <div class="chip-list">
            <span class="badge">${escapeHtml(workflow.model_family || "model family")}</span>
            <span class="badge amber">${escapeHtml(workflow.model || "model")}</span>
            <span class="badge">${sampleCount} samples</span>
          </div>
        </div>
        <div class="workspace-comparison-card comparison-alt">
          <strong>Outside workflow</strong>
          <p>This is a frontend mock for cross-workflow comparison. It will later render a peer workflow or stage target.</p>
          <div class="workspace-comparison-placeholder">Select a comparison target from the dashboard.</div>
        </div>
      </div>
    </section>
  `;
}

function renderAssemblyPane(workspace, transcriptions, summary) {
  const workflow = workspace?.workflow || {};
  const firstTranscription = transcriptions[0] || null;
  const groups = Array.isArray(workflow.groups) ? workflow.groups : [];

  return `
    <section class="panel workspace-assembly-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Assembly</h2>
          <span>Configure and persist transcription outputs</span>
        </div>
        <div class="toolbar">
          <button class="btn-secondary" type="button" data-action="assemble-transcriptions">Assemble all</button>
          <button class="btn-primary" type="button" data-action="score-transcriptions" ${transcriptions.length ? "" : "disabled"}>Score all</button>
        </div>
      </div>
      <div class="workspace-assembly-copy">
        <div class="workspace-assembly-summary">
          <span class="badge">${escapeHtml(workflowStageLabel(workspace))}</span>
          <span class="badge amber">${transcriptions.length} outputs</span>
          <span class="badge">${groups.length ? `${groups.length} grouping rule(s)` : "No grouping rules"}</span>
        </div>
        <p>${groups.length ? `Outputs partition by the workflow grouping rules: ${groups.map((group) => `<code>${escapeHtml(group)}</code>`).join(", ")}.` : "Outputs map one-to-one from job output to transcription records."}</p>
      </div>
      <div class="detail-grid">
        <div class="detail-card">
          <h3>Result summary</h3>
          <div class="metadata-grid">
            <div class="metadata-row"><span>Transcriptions</span><strong>${transcriptions.length}</strong></div>
            <div class="metadata-row"><span>Mean CER</span><strong>${escapeHtml(formatMetric(summary.cer?.mean))}</strong></div>
            <div class="metadata-row"><span>Mean WER</span><strong>${escapeHtml(formatMetric(summary.wer?.mean))}</strong></div>
            <div class="metadata-row"><span>Mean hallucinations</span><strong>${escapeHtml(formatMetric(summary.hallucinations?.mean))}</strong></div>
          </div>
        </div>
        <div class="detail-card">
          <h3>Latest output</h3>
          ${firstTranscription ? `
            <strong>${escapeHtml(transcriptionOutputName(firstTranscription))}</strong>
            <pre>${escapeHtml(truncate(firstTranscription.transcription_text || "", 240))}</pre>
          ` : `<div class="empty-state">No transcriptions have been assembled yet.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderReviewPane({
  transcriptions,
  selectedTranscriptionId,
  selectedTranscriptionDetail = null,
  reviewQuery,
  reviewSort,
  reviewCompareExpanded,
}) {
  const filtered = sortTranscriptions(filterTranscriptions(transcriptions, reviewQuery), reviewSort);
  const selected = selectedTranscription(filtered, selectedTranscriptionId);
  const selectedDetailRowId = Number(selectedTranscriptionDetail?.transcription?.transcription_id);
  const selectedRowId = Number(selected?.transcription_id);
  const detail = selectedDetailRowId && selectedDetailRowId === selectedRowId
    ? selectedTranscriptionDetail?.transcription || selected
    : selected;
  const groundTruthText = selectedDetailRowId && selectedDetailRowId === selectedRowId
    ? (selectedTranscriptionDetail?.ground_truth_text || detail?.ground_truth_text || detail?.ground_truth || "")
    : (detail?.ground_truth_text || detail?.ground_truth || "")
    || "";
  const summary = aggregateMetrics(filtered);

  const rows = filtered.length
    ? filtered.map((transcription) => {
      const isSelected = Number(transcription.transcription_id) === Number(selected?.transcription_id);
      return `
        <button class="review-row ${isSelected ? "is-selected" : ""}" type="button"
          data-action="select-transcription" data-transcription-id="${escapeHtml(transcription.transcription_id)}">
          <div class="review-row-top">
            <strong>${escapeHtml(transcriptionOutputName(transcription))}</strong>
            <span class="badge ${transcription.job_id != null ? "green" : "amber"}">${escapeHtml(transcription.job_id != null ? `job ${transcription.job_id}` : "manual")}</span>
          </div>
          <div class="review-row-metrics">
            ${renderMetricChip("CER", transcription.cer)}
            ${renderMetricChip("WER", transcription.wer)}
          </div>
          <div class="meta-line">
            <span>${escapeHtml(transcription.status || "ready")}</span>
            <span>${escapeHtml(formatDate(transcription.updated_at || transcription.created_at))}</span>
          </div>
        </button>
      `;
    }).join("")
    : `<div class="empty-state">No transcriptions match the current search.</div>`;

  return `
    <section class="panel workspace-review-panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Transcription review</h2>
          <span>Search by output name and sort by score, creation time, or sample ID</span>
        </div>
        <div class="toolbar">
          <button class="btn-secondary" type="button" data-action="assemble-transcriptions">Assemble all</button>
          <button class="btn-primary" type="button" data-action="score-transcriptions" ${filtered.length ? "" : "disabled"}>Score all</button>
        </div>
      </div>
      <div class="workspace-review-toolbar">
        <label class="field workspace-review-search">
          <span>Search</span>
          <input id="workspace-review-search" value="${escapeHtml(reviewQuery)}" placeholder="Search output_name"
            data-workspace-review-field="query" />
        </label>
        <label class="field workspace-review-sort">
          <span>Sort</span>
          <select id="workspace-review-sort" data-workspace-review-field="sort">
            <option value="score" ${reviewSort === "score" ? "selected" : ""}>Score</option>
            <option value="created_at" ${reviewSort === "created_at" ? "selected" : ""}>Creation time</option>
            <option value="sample_id" ${reviewSort === "sample_id" ? "selected" : ""}>Sample ID</option>
          </select>
        </label>
      </div>
      <div class="workspace-review-summary">
        <span class="badge">${filtered.length} shown</span>
        <span class="badge amber">${summary.cer != null ? `CER mean ${formatMetric(summary.cer.mean)}` : "CER n/a"}</span>
        <span class="badge amber">${summary.wer != null ? `WER mean ${formatMetric(summary.wer.mean)}` : "WER n/a"}</span>
      </div>
      <div class="workspace-review-layout">
        <div class="workspace-review-list" data-preserve-scroll-key="workspace-review-list">${rows}</div>
        <div class="workspace-review-detail">
          ${selected ? `
            <section class="detail-card workspace-review-inspector">
              <div class="panel-header">
                <div class="panel-title">
                  <h2>${escapeHtml(transcriptionOutputName(selected))}</h2>
                  <span>${escapeHtml(selected.group_name ? `${selected.group_name}: ${selected.group_value || "Unassigned"}` : "Standalone output")}</span>
                </div>
                <button class="btn-ghost btn-tight" type="button" data-action="toggle-review-compare">${reviewCompareExpanded ? "Collapse compare" : "Expand compare"}</button>
              </div>

              <div class="metadata-grid">
                <div class="metadata-row"><span>Transcription</span><strong>${escapeHtml(detail?.transcription_id ?? "n/a")}</strong></div>
                <div class="metadata-row"><span>Job</span><strong>${escapeHtml(detail?.job_id ?? selected.job_id ?? "n/a")}</strong></div>
                <div class="metadata-row"><span>Sample IDs</span><strong>${escapeHtml(Array.isArray(detail?.sample_ids) ? detail.sample_ids.join(", ") : detail?.sample_id || selected.sample_id || "n/a")}</strong></div>
                <div class="metadata-row"><span>Updated</span><strong>${escapeHtml(formatDate(detail?.updated_at || detail?.created_at || selected.updated_at || selected.created_at))}</strong></div>
              </div>

              <div class="workspace-metrics-block">
                ${["cer", "wer", "hallucinations", "line_omission_count", "line_addition_count"].map((key) => `
                  <div class="metric-tile ${toneForMetric(detail?.[key] ?? selected[key])}">
                    <span>${escapeHtml(key.replace(/_/g, " ").toUpperCase())}</span>
                    <strong>${escapeHtml(formatMetric(detail?.[key] ?? selected[key]))}</strong>
                    <small>${detail?.metrics?.[key] != null || selected.metrics?.[key] != null ? "from metrics payload" : "record field"}</small>
                  </div>
                `).join("")}
              </div>

              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Model output</h3>
                  <pre>${escapeHtml(detail?.transcription_text || selected.transcription_text || "")}</pre>
                </div>
                <div class="detail-card">
                  <h3>Ground truth</h3>
                  <pre>${escapeHtml(groundTruthText || "No ground truth provided by the detail payload.")}</pre>
                </div>
              </div>

              ${reviewCompareExpanded ? `
                <div class="workspace-compare-detail">
                  <h3>Compare view</h3>
                  <div class="detail-grid">
                    <div class="detail-card">
                      <h4>Source context</h4>
                      <pre>${escapeHtml(JSON.stringify({
                        sample_id: detail?.sample_id || selected.sample_id,
                        sample_ids: detail?.sample_ids || selected.sample_ids || [],
                        group_name: detail?.group_name || selected.group_name,
                        group_value: detail?.group_value || selected.group_value,
                        output_index: detail?.output_index || selected.output_index,
                      }, null, 2))}</pre>
                    </div>
                    <div class="detail-card">
                      <h4>Scoring context</h4>
                      <pre>${escapeHtml(JSON.stringify(detail?.metrics || selected.metrics || {
                        cer: detail?.cer ?? selected.cer,
                        wer: detail?.wer ?? selected.wer,
                        hallucinations: detail?.hallucinations ?? selected.hallucinations,
                        line_omission_count: detail?.line_omission_count ?? selected.line_omission_count,
                        line_addition_count: detail?.line_addition_count ?? selected.line_addition_count,
                      }, null, 2))}</pre>
                    </div>
                  </div>
                </div>
              ` : ""}
            </section>
          ` : `<div class="empty-state">Select a transcription to open the inspector.</div>`}
        </div>
      </div>
    </section>
  `;
}

export function renderWorkspacePanel({
  workspace,
  loading,
  error,
  activePane = "jobs",
  jobSelection = {},
  reviewQuery = "",
  reviewSort = "score",
  selectedTranscriptionId = null,
  selectedTranscription = null,
  reviewCompareExpanded = false,
}) {
  const pendingJobs = Array.isArray(workspace?.pending_jobs) ? workspace.pending_jobs : [];
  const queuedJobs = Array.isArray(workspace?.queued_jobs) ? workspace.queued_jobs : [];
  const completedJobs = Array.isArray(workspace?.completed_jobs) ? workspace.completed_jobs : [];
  const transcriptions = Array.isArray(workspace?.transcriptions) ? workspace.transcriptions : [];
  const summary = aggregateMetrics(transcriptions);
  const pendingSelected = selectedJobIds(jobSelection, "pending");
  const queuedSelected = selectedJobIds(jobSelection, "queued");
  const completedSelected = selectedJobIds(jobSelection, "completed");
  const currentPane = PANES.some((pane) => pane.key === activePane) ? activePane : "jobs";

  return `
    <section class="workspace-shell">
      <section class="panel workspace-header-panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>${escapeHtml(workspace?.workflow?.workflow_name || "Workflow workspace")}</h2>
            <span>
              ${escapeHtml(workflowStageLabel(workspace))}
              ${workspace?.workflow?.model_family ? `| ${escapeHtml(workspace.workflow.model_family)}` : ""}
              ${workspace?.workflow?.model ? `| ${escapeHtml(workspace.workflow.model)}` : ""}
            </span>
          </div>
          ${renderMetricTile("Pending", pendingJobs.length, `${pendingSelected.length} selected`, "amber")}
          ${renderMetricTile("Queued", queuedJobs.length, `${queuedSelected.length} selected`, "amber")}
          ${renderMetricTile("Completed", completedJobs.length, `${completedSelected.length} selected`, "good")}
          ${renderMetricTile("Transcriptions", transcriptions.length, `${transcriptions.length} reviewable`, "good")}
          <div class="toolbar">
            <button class="btn-secondary" type="button" data-action="create-workspace-jobs">Generate jobs</button>
            <button class="btn-danger" type="button" data-action="delete-workspace-jobs">Delete jobs</button>
          </div>
        </div>
      </section>

      <div class="workspace-layout">
        <aside class="panel workspace-sidebar">
          <div class="panel-header">
            <div class="panel-title">
              <h2>Stages</h2>
              <span>Jobs, assembly, and review</span>
            </div>
          </div>
          <div class="workspace-stage-nav">
            ${PANES.map((pane) => renderPaneButton({ activePane: currentPane, pane })).join("")}
          </div>
          <div class="workspace-sidebar-copy">
            <div class="count-label">The stage rail borrows the card language from the dashboard so the new screen still feels native to ScriptBench.</div>
          </div>
        </aside>

        <main class="workspace-main">
          ${loading ? `<div class="empty-state">Loading workspace...</div>` : ""}
          ${error ? `<div class="error-banner">${escapeHtml(error)}</div>` : ""}
          ${currentPane === "jobs" ? `
            <section class="workspace-execution-grid">
              <div class="workspace-job-grid">
                ${renderJobPanel({
                  kind: "pending",
                  title: "Pending jobs",
                  description: "Ready to queue and send to model.",
                  jobs: pendingJobs,
                  selection: jobSelection,
                  primaryAction: "queue-selected-jobs",
                })}
                ${renderJobPanel({
                  kind: "queued",
                  title: "Queued jobs",
                  description: "In flight or waiting on execution.",
                  jobs: queuedJobs,
                  selection: jobSelection,
                  primaryAction: "unqueue-selected-jobs",
                })}
                ${renderJobPanel({
                  kind: "completed",
                  title: "Completed jobs",
                  description: "Finished jobs which can be retried.",
                  jobs: completedJobs,
                  selection: jobSelection,
                  primaryAction: "retry-selected-jobs",
                })}
              </div>
              ${renderAssemblyPane(workspace, transcriptions, summary)}
              ${renderReviewPane({
                transcriptions,
                selectedTranscriptionId,
                selectedTranscriptionDetail: selectedTranscription,
                reviewQuery,
                reviewSort,
                reviewCompareExpanded,
              })}
            </section>
          ` : ""}
          ${currentPane === "assembly" ? renderAssemblyPane(workspace, transcriptions, summary) : ""}
          ${currentPane === "review" ? renderReviewPane({
            transcriptions,
            selectedTranscriptionId,
            selectedTranscriptionDetail: selectedTranscription,
            reviewQuery,
            reviewSort,
            reviewCompareExpanded,
          }) : ""}
        </main>
      </div>
    </section>
  `;
}
