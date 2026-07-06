"use client";

import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";

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

function IconBadge({ kind, className = "" }) {
  const icons = {
    sampleSets: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 16.5c2.2 0 3.6-1.3 4.8-3s2.6-3 4.8-3 2.6 1.3 3.8 3 2.6 3 4.6 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M5.5 19.5h13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="6" cy="8" r="1.2" fill="currentColor" />
        <path d="M17 6.5l1.6 1.6 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    sampleSet: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h14M5 12h14M5 16h9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path
          d="M7 4.8 4 6.4v10.8l3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V6.4l-3-1.6-3 1.6-3-1.6-3 1.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
    workflows: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="16" y="4" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="9.5" y="15" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 9.5v3.1c0 1.1.9 2 2 2h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M18.5 9.5v3.1c0 1.1-.9 2-2 2h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    samples: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6.5h10a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H8.5L4 21V8.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 11h8M8 14h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    cer: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 15.5c2.6 0 3.7-2 5-4.1 1.2-2 2.6-4 5.2-4s3.6 1.6 5.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="8" r="1.1" fill="currentColor" />
      </svg>
    ),
    wer: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H13l-4.2 3v-3H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 10h8M8 13h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    hallucinations: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5 14.8 8l4.2.7-2.7 3.3.6 4.2-4-1.8-3.9 1.8.5-4.2L6.8 8.7 11 8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    chevron: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    trash: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 7h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <span className={["icon-badge", className].filter(Boolean).join(" ")} aria-hidden="true">
      {icons[kind] || null}
    </span>
  );
}

function MetricPill({ label, value, tone }) {
  return (
    <div className={["metric-bubble", tone].filter(Boolean).join(" ")}>
      <IconBadge kind={tone} className="metric-icon" />
      <div>
        <span>{label}</span>
        <strong>{formatMetricValue(value)}</strong>
      </div>
    </div>
  );
}

function MetricCard({ label, metric }) {
  const tone = getMetricTone(label);

  if (!metric) {
    return (
      <article className={["detail-card", "analytics-metric-card", tone].filter(Boolean).join(" ")}>
        <div className="analytics-metric-heading">
          <IconBadge kind={tone} className="metric-card-icon" />
          <h3>{label}</h3>
        </div>
        <div className="analytics-empty analytics-empty-centered">
          <IconBadge kind="sampleSet" className="empty-widget-icon" />
          <span>No values available yet.</span>
        </div>
      </article>
    );
  }

  return (
    <article className={["detail-card", "analytics-metric-card", tone].filter(Boolean).join(" ")}>
      <div className="analytics-metric-heading">
        <IconBadge kind={tone} className="metric-card-icon" />
        <h3>{label}</h3>
      </div>
      <div className="metric-bubble-row">
        <MetricPill label="Min" value={metric.min} tone="min" />
        <MetricPill label="Median" value={metric.median} tone="median" />
        <MetricPill label="Max" value={metric.max} tone="max" />
      </div>
    </article>
  );
}

function formatWorkflowMeta(workflow) {
  const stage = workflow.workflow_stage || workflow.stage || "n/a";
  const modelFamily = workflow.model_family || "n/a";
  const model = workflow.model || "n/a";
  return `${stage} | ${modelFamily} | ${model}`;
}

function WorkflowMiniCard({ workflow, onDeleteWorkflow }) {
  const workflowName = workflow.workflow_name || `Workflow ${workflow.workflow_id}`;

  return (
    <div className="analytics-mini-card analytics-mini-workflow-card">
      <div className="analytics-mini-copy">
        <div className="analytics-mini-workflow-copy">
          <strong>{workflowName}</strong>
          <span>{formatWorkflowMeta(workflow)}</span>
        </div>
      </div>
      <button
        className="btn-danger btn-tight icon-delete-button analytics-mini-delete-button"
        type="button"
        onClick={() => onDeleteWorkflow?.(Number(workflow.workflow_id), workflowName)}
        aria-label={`Delete workflow ${workflowName}`}
        title="Delete workflow"
      >
        <IconBadge kind="trash" />
      </button>
    </div>
  );
}

function SampleMiniCard({ sampleId }) {
  return (
    <div className="analytics-mini-card">
      <strong>{sampleId}</strong>
    </div>
  );
}

function AnalyticsLoadingState() {
  return (
    <section className="sample-set-analytics-shell analytics-loading-shell" aria-busy="true" aria-live="polite">
      <section className="detail-card sample-set-summary-card analytics-summary-skeleton">
        <div className="sample-set-summary-top">
          <div className="sample-set-summary-heading">
            <IconBadge kind="sampleSets" className="summary-icon" />
            <div className="sample-set-summary-copy">
              <div className="eyebrow">Sample set analytics</div>
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line skeleton-line-subtitle" />
            </div>
          </div>
          <div className="summary-chip-row">
            <span className="summary-chip skeleton-chip">
              <IconBadge kind="workflows" className="summary-chip-icon" />
              <span className="summary-chip-copy">
                <span className="skeleton-line skeleton-line-value" />
                <span className="skeleton-line skeleton-line-label" />
              </span>
            </span>
            <span className="summary-chip skeleton-chip">
              <IconBadge kind="samples" className="summary-chip-icon" />
              <span className="summary-chip-copy">
                <span className="skeleton-line skeleton-line-value" />
                <span className="skeleton-line skeleton-line-label" />
              </span>
            </span>
          </div>
        </div>
      </section>

      <details className="analytics-accordion" open>
        <summary>
          <span className="accordion-title">
            <IconBadge kind="cer" className="accordion-icon" />
            <span>Metrics</span>
          </span>
          <span className="accordion-meta">
            <span className="count-label">CER, WER, Hallucinations</span>
            <IconBadge kind="chevron" className="accordion-chevron" />
          </span>
        </summary>
        <div className="analytics-metric-grid">
          {["cer", "wer", "hallucinations"].map((tone) => (
            <article key={tone} className={["detail-card", "analytics-metric-card", tone, "analytics-skeleton-card"].filter(Boolean).join(" ")}>
              <div className="analytics-metric-heading">
                <IconBadge kind={tone} className="metric-card-icon" />
                <span className="skeleton-line skeleton-line-title" />
              </div>
              <div className="metric-bubble-row">
                <div className="metric-bubble skeleton-bubble">
                  <IconBadge kind={tone} className="metric-icon" />
                  <div>
                    <span className="skeleton-line skeleton-line-label" />
                    <strong className="skeleton-line skeleton-line-value" />
                  </div>
                </div>
                <div className="metric-bubble skeleton-bubble">
                  <IconBadge kind={tone} className="metric-icon" />
                  <div>
                    <span className="skeleton-line skeleton-line-label" />
                    <strong className="skeleton-line skeleton-line-value" />
                  </div>
                </div>
                <div className="metric-bubble skeleton-bubble">
                  <IconBadge kind={tone} className="metric-icon" />
                  <div>
                    <span className="skeleton-line skeleton-line-label" />
                    <strong className="skeleton-line skeleton-line-value" />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </details>

      <details className="analytics-accordion">
        <summary>
          <span className="accordion-title">
            <span>Workflows</span>
          </span>
          <span className="accordion-meta">
            <span className="count-label">Loading...</span>
            <IconBadge kind="chevron" className="accordion-chevron" />
          </span>
        </summary>
        <div className="analytics-mini-list analytics-mini-list-skeleton">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="analytics-mini-card analytics-skeleton-card">
              <span className="skeleton-line skeleton-line-title" />
              <span className="skeleton-line skeleton-line-subtitle" />
            </div>
          ))}
        </div>
      </details>

      <details className="analytics-accordion">
        <summary>
          <span className="accordion-title">
            <span>Samples</span>
          </span>
          <span className="accordion-meta">
            <span className="count-label">Loading...</span>
            <IconBadge kind="chevron" className="accordion-chevron" />
          </span>
        </summary>
        <div className="analytics-mini-list analytics-mini-list-skeleton">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="analytics-mini-card analytics-skeleton-card">
              <span className="skeleton-line skeleton-line-title" />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

export function SampleSetAnalyticsPanel({
  workflow,
  sampleSet,
  sampleSetAnalytics,
  analyticsLoading = false,
  analyticsError = "",
  onDeleteWorkflow,
}) {
  if (analyticsError) {
    return (
      <Panel className="sample-set-analytics-panel">
        <EmptyState>{analyticsError}</EmptyState>
      </Panel>
    );
  }

  if (analyticsLoading) {
    return (
      <Panel className="sample-set-analytics-panel">
        <AnalyticsLoadingState />
      </Panel>
    );
  }

  if (!sampleSetAnalytics) {
    return (
      <Panel className="sample-set-analytics-panel">
        <EmptyState>{workflow ? "No analytics available for this sample set." : "Click a sample set to view analytics."}</EmptyState>
      </Panel>
    );
  }

  const selectedSampleSet = sampleSet || sampleSetAnalytics.sample_set || {};
  const metrics = sampleSetAnalytics.metrics || {};
  const workflowRows = sampleSetAnalytics.workflows || [];
  const sampleIds = sampleSetAnalytics.sample_ids || selectedSampleSet.sample_ids || [];
  const workflowCount = Number(selectedSampleSet.workflow_count ?? sampleSetAnalytics.workflow_count ?? workflowRows.length ?? 0);
  const sampleCount = Number(selectedSampleSet.sample_count ?? sampleIds.length ?? 0);
  const groupingNames = Array.from(
    new Set(
      workflowRows.flatMap((currentWorkflow) =>
        Array.isArray(currentWorkflow?.groups)
          ? currentWorkflow.groups.map((group) => String(group).trim()).filter(Boolean)
          : [],
      ),
    ),
  );
  const groupingLabel = groupingNames.length ? groupingNames.join(", ") : "none";

  return (
    <Panel className="sample-set-analytics-panel">
      <section className="sample-set-analytics-shell">
        <section className="detail-card sample-set-summary-card">
          <div className="sample-set-summary-top">
            <div className="sample-set-summary-heading">
              <IconBadge kind="sampleSets" className="summary-icon" />
              <div className="sample-set-summary-copy">
                <div className="eyebrow">Sample set analytics</div>
                <h3>{selectedSampleSet.sample_set_name || "Sample set"}</h3>
              </div>
            </div>
            <div className="summary-chip-row">
              <span className="summary-chip">
                <IconBadge kind="workflows" className="summary-chip-icon" />
                <span className="summary-chip-copy">
                  <strong>{workflowCount}</strong>
                  <span>workflows</span>
                </span>
              </span>
              <span className="summary-chip" title={groupingLabel}>
                <IconBadge kind="sampleSet" className="summary-chip-icon" />
                <span className="summary-chip-copy">
                  <strong>{groupingNames.length}</strong>
                  <span>
                    {groupingNames.length === 1 ? "grouping" : "groupings"}
                    {groupingNames.length ? `: ${groupingLabel}` : ""}
                  </span>
                </span>
              </span>
              <span className="summary-chip">
                <IconBadge kind="samples" className="summary-chip-icon" />
                <span className="summary-chip-copy">
                  <strong>{sampleCount}</strong>
                  <span>samples</span>
                </span>
              </span>
            </div>
          </div>
        </section>

        <details className="analytics-accordion" open>
          <summary>
            <span className="accordion-title">
              <IconBadge kind="cer" className="accordion-icon" />
              <span>Metrics</span>
            </span>
            <span className="accordion-meta">
              <span className="count-label">CER, WER, Hallucinations</span>
              <IconBadge kind="chevron" className="accordion-chevron" />
            </span>
          </summary>
          <div className="analytics-metric-grid">
            <MetricCard label="CER" metric={metrics.cer} />
            <MetricCard label="WER" metric={metrics.wer} />
            <MetricCard label="Hallucinations" metric={metrics.hallucinations} />
          </div>
        </details>

        <details className="analytics-accordion">
          <summary>
            <span className="accordion-title">
              <span>Workflows</span>
            </span>
            <span className="accordion-meta">
              <span className="count-label">{workflowRows.length} items</span>
              <IconBadge kind="chevron" className="accordion-chevron" />
            </span>
          </summary>
          <div className="analytics-mini-list">
            {workflowRows.length ? (
              workflowRows.map((currentWorkflow) => (
                <WorkflowMiniCard
                  key={currentWorkflow.workflow_id}
                  workflow={currentWorkflow}
                  onDeleteWorkflow={onDeleteWorkflow}
                />
              ))
            ) : (
              <EmptyState>No workflows are attached to this sample set yet.</EmptyState>
            )}
          </div>
        </details>

        <details className="analytics-accordion">
          <summary>
            <span className="accordion-title">
              <span>Samples</span>
            </span>
            <span className="accordion-meta">
              <span className="count-label">{sampleIds.length} items</span>
              <IconBadge kind="chevron" className="accordion-chevron" />
            </span>
          </summary>
          <div className="analytics-mini-list analytics-mini-list-scroll">
            {sampleIds.length ? sampleIds.map((sampleId) => <SampleMiniCard key={sampleId} sampleId={sampleId} />) : <EmptyState>No samples are attached to this sample set yet.</EmptyState>}
          </div>
        </details>
      </section>
    </Panel>
  );
}
