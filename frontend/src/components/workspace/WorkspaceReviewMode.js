"use client";

import { formatDate } from "../../utils/date.js";
import { formatMetric } from "../../utils/metrics.js";
import { aggregateMetrics, toneForMetric } from "../../domains/workspace/metrics.js";
import {
  filterTranscriptions,
  selectedTranscription as pickSelectedTranscription,
  sortTranscriptions,
  transcriptionOutputName,
} from "../../domains/workspace/transcription.js";

export function WorkspaceReviewMode({
  transcriptions = [],
  selectedTranscriptionId = null,
  selectedTranscription: selectedTranscriptionDetail = null,
  reviewQuery = "",
  reviewSort = "score",
  reviewCompareExpanded = false,
  actions,
}) {
  const filtered = sortTranscriptions(filterTranscriptions(transcriptions, reviewQuery), reviewSort);
  const selected = pickSelectedTranscription(filtered, selectedTranscriptionId);
  const selectedDetailRowId = Number(selectedTranscriptionDetail?.transcription?.transcription_id);
  const selectedRowId = Number(selected?.transcription_id);
  const detail =
    selectedDetailRowId && selectedDetailRowId === selectedRowId
      ? selectedTranscriptionDetail?.transcription || selected
      : selected;
  const groundTruthText =
    (selectedDetailRowId && selectedDetailRowId === selectedRowId
      ? selectedTranscriptionDetail?.ground_truth_text || detail?.ground_truth_text || detail?.ground_truth || ""
      : detail?.ground_truth_text || detail?.ground_truth || "") || "";
  const summary = aggregateMetrics(filtered);

  return (
    <section className="panel workspace-review-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>Transcription review</h2>
          <span>Search by output name and sort by score, creation time, or sample ID</span>
        </div>
        <div className="toolbar">
          <button className="btn-secondary" type="button" onClick={actions?.assembleTranscriptions}>
            Assemble all
          </button>
          <button className="btn-primary" type="button" onClick={actions?.scoreWorkspace} disabled={!filtered.length}>
            Score all
          </button>
        </div>
      </div>
      <div className="workspace-review-toolbar">
        <label className="field workspace-review-search">
          <span>Search</span>
          <input
            id="workspace-review-search"
            value={reviewQuery}
            placeholder="Search output_name"
            onChange={(event) => actions?.setWorkspaceReviewQuery?.(event.target.value)}
          />
        </label>
        <label className="field workspace-review-sort">
          <span>Sort</span>
          <select
            id="workspace-review-sort"
            value={reviewSort}
            onChange={(event) => actions?.setWorkspaceReviewSort?.(event.target.value)}
          >
            <option value="score">Score</option>
            <option value="created_at">Creation time</option>
            <option value="sample_id">Sample ID</option>
          </select>
        </label>
      </div>
      <div className="workspace-review-summary">
        <span className="badge">{filtered.length} shown</span>
        <span className="badge amber">{summary.cer != null ? `CER mean ${formatMetric(summary.cer.mean)}` : "CER n/a"}</span>
        <span className="badge amber">{summary.wer != null ? `WER mean ${formatMetric(summary.wer.mean)}` : "WER n/a"}</span>
      </div>
      <div className="workspace-review-layout">
        <div className="workspace-review-list" data-preserve-scroll-key="workspace-review-list">
          {filtered.length ? (
            filtered.map((transcription) => {
              const isSelected = Number(transcription.transcription_id) === Number(selected?.transcription_id);

              return (
                <button
                  key={transcription.transcription_id}
                  className={`review-row ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  onClick={() => actions?.selectTranscription?.(transcription.transcription_id)}
                >
                  <div className="review-row-top">
                    <strong>{transcriptionOutputName(transcription)}</strong>
                    <span className={`badge ${transcription.job_id != null ? "green" : "amber"}`}>
                      {transcription.job_id != null ? `job ${transcription.job_id}` : "manual"}
                    </span>
                  </div>
                  <div className="review-row-metrics">
                    <span className={`metric-chip ${toneForMetric(transcription.cer)}`}>
                      <span>CER</span>
                      <strong>{formatMetric(transcription.cer)}</strong>
                    </span>
                    <span className={`metric-chip ${toneForMetric(transcription.wer)}`}>
                      <span>WER</span>
                      <strong>{formatMetric(transcription.wer)}</strong>
                    </span>
                  </div>
                  <div className="meta-line">
                    <span>{transcription.status || "ready"}</span>
                    <span>{formatDate(transcription.updated_at || transcription.created_at)}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="empty-state">No transcriptions match the current search.</div>
          )}
        </div>
        <div className="workspace-review-detail">
          {selected ? (
            <section className="detail-card workspace-review-inspector">
              <div className="panel-header">
                <div className="panel-title">
                  <h2>{transcriptionOutputName(selected)}</h2>
                  <span>{selected.group_name ? `${selected.group_name}: ${selected.group_value || "Unassigned"}` : "Standalone output"}</span>
                </div>
                <button className="btn-ghost btn-tight" type="button" onClick={actions?.toggleReviewCompare}>
                  {reviewCompareExpanded ? "Collapse compare" : "Expand compare"}
                </button>
              </div>

              <div className="metadata-grid">
                <div className="metadata-row">
                  <span>Transcription</span>
                  <strong>{detail?.transcription_id ?? "n/a"}</strong>
                </div>
                <div className="metadata-row">
                  <span>Job</span>
                  <strong>{detail?.job_id ?? selected.job_id ?? "n/a"}</strong>
                </div>
                <div className="metadata-row">
                  <span>Sample IDs</span>
                  <strong>
                    {Array.isArray(detail?.sample_ids)
                      ? detail.sample_ids.join(", ")
                      : detail?.sample_id || selected.sample_id || "n/a"}
                  </strong>
                </div>
                <div className="metadata-row">
                  <span>Updated</span>
                  <strong>{formatDate(detail?.updated_at || detail?.created_at || selected.updated_at || selected.created_at)}</strong>
                </div>
              </div>

              <div className="workspace-metrics-block">
                {["cer", "wer", "hallucinations", "line_omission_count", "line_addition_count"].map((key) => (
                  <div key={key} className={`metric-tile ${toneForMetric(detail?.[key] ?? selected[key])}`}>
                    <span>{key.replace(/_/g, " ").toUpperCase()}</span>
                    <strong>{formatMetric(detail?.[key] ?? selected[key])}</strong>
                    <small>
                      {detail?.metrics?.[key] != null || selected.metrics?.[key] != null ? "from metrics payload" : "record field"}
                    </small>
                  </div>
                ))}
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <h3>Model output</h3>
                  <pre>{detail?.transcription_text || selected.transcription_text || ""}</pre>
                </div>
                <div className="detail-card">
                  <h3>Ground truth</h3>
                  <pre>{groundTruthText || "No ground truth provided by the detail payload."}</pre>
                </div>
              </div>

              {reviewCompareExpanded ? (
                <div className="workspace-compare-detail">
                  <h3>Compare view</h3>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <h4>Source context</h4>
                      <pre>
                        {JSON.stringify(
                          {
                            sample_id: detail?.sample_id || selected.sample_id,
                            sample_ids: detail?.sample_ids || selected.sample_ids || [],
                            group_name: detail?.group_name || selected.group_name,
                            group_value: detail?.group_value || selected.group_value,
                            output_index: detail?.output_index || selected.output_index,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                    <div className="detail-card">
                      <h4>Scoring context</h4>
                      <pre>
                        {JSON.stringify(
                          detail?.metrics || selected.metrics || {
                            cer: detail?.cer ?? selected.cer,
                            wer: detail?.wer ?? selected.wer,
                            hallucinations: detail?.hallucinations ?? selected.hallucinations,
                            line_omission_count: detail?.line_omission_count ?? selected.line_omission_count,
                            line_addition_count: detail?.line_addition_count ?? selected.line_addition_count,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="empty-state">Select a transcription to open the inspector.</div>
          )}
        </div>
      </div>
    </section>
  );
}
