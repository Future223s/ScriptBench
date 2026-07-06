"use client";

import { safeJsonParse, safeJsonStringify } from "../../utils/json.js";

function JsonTree({ value }) {
  if (value == null) {
    return (
      <div className="json-tree">
        <div className="json-line json-null">null</div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="json-tree">
        <div className="json-line json-bracket">[</div>
        {value.map((item, index) => (
          <JsonTreeLine key={index} keyLabel={`[${index}]`} value={item} isLast={index === value.length - 1} />
        ))}
        <div className="json-line json-bracket">]</div>
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    return (
      <div className="json-tree">
        <div className="json-line json-bracket">{`{`}</div>
        {entries.map(([key, item], index) => (
          <JsonTreeLine key={key} keyLabel={key} value={item} isLast={index === entries.length - 1} />
        ))}
        <div className="json-line json-bracket">{`}`}</div>
      </div>
    );
  }

  return (
    <div className="json-tree">
      <div className="json-line json-scalar">{renderJsonScalar(value)}</div>
    </div>
  );
}

function JsonTreeLine({ keyLabel, value, isLast }) {
  if (value == null || typeof value !== "object") {
    return (
      <div className="json-line json-pair">
        <span className="json-key">{JSON.stringify(keyLabel)}:</span>
        <span className="json-value json-scalar">
          {renderJsonScalar(value)}
          {isLast ? "" : ","}
        </span>
      </div>
    );
  }

  return (
    <div className="json-line json-pair json-nested">
      <div className="json-key-line">{JSON.stringify(keyLabel)}:</div>
      <div className="json-nested-block">
        <JsonTree value={value} />
      </div>
      {isLast ? null : <div className="json-line json-comma">,</div>}
    </div>
  );
}

function renderJsonScalar(value) {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

export function JobDetailModal({ open, job, onClose }) {
  if (!open) return null;

  const sampleIds = Array.isArray(job?.sample_ids) ? job.sample_ids : [];
  const promptJson = safeJsonStringify(job?.resolved_prompt);
  const transcriptionText = job?.raw_content || "";
  const transcriptionParsed = safeJsonParse(transcriptionText);

  return (
    <div className="modal-backdrop" data-modal="job-detail">
      <section className="modal job-modal">
        <div className="modal-header">
          <div className="panel-title">
            <h2>Job {job?.job_id || ""}</h2>
            <span>{job?.status || "Unknown status"}</span>
          </div>
          <button className="btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="job-detail-grid">
            <div className="detail-card">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                <div className="metadata-row">
                  <span>Workflow</span>
                  <strong>{job?.workflow_id || ""}</strong>
                </div>
                <div className="metadata-row">
                  <span>Job</span>
                  <strong>{job?.job_id || ""}</strong>
                </div>
                <div className="metadata-row">
                  <span>Status</span>
                  <strong>{job?.status || ""}</strong>
                </div>
                <div className="metadata-row">
                  <span>Elapsed</span>
                  <strong>{job?.time_elapsed != null ? `${Number(job.time_elapsed).toFixed(1)}s` : "n/a"}</strong>
                </div>
                <div className="metadata-row">
                  <span>Created</span>
                  <strong>{job?.created_at || ""}</strong>
                </div>
                <div className="metadata-row">
                  <span>Started</span>
                  <strong>{job?.started_at || ""}</strong>
                </div>
                <div className="metadata-row">
                  <span>Completed</span>
                  <strong>{job?.completed_at || ""}</strong>
                </div>
              </div>
              <div className="field">
                <label>Sample IDs</label>
                <div className="chip-list">
                  {sampleIds.length ? (
                    sampleIds.map((sampleId) => (
                      <span key={sampleId} className="badge">
                        {sampleId}
                      </span>
                    ))
                  ) : (
                    <span className="count-label">No sample IDs attached.</span>
                  )}
                </div>
              </div>
              {job?.failure_reason ? (
                <div className="field wide">
                  <label>Failure reason</label>
                  <pre>{job.failure_reason}</pre>
                </div>
              ) : null}
            </div>
            <div className="job-detail-right">
              <details className="detail-card detail-accordion">
                <summary>
                  <h3>Resolved prompt</h3>
                  <span>Expand to inspect the prompt payload</span>
                </summary>
                <pre>{promptJson || "No resolved prompt available."}</pre>
              </details>
              <details className="detail-card detail-accordion">
                <summary>
                  <h3>Transcription content</h3>
                  <span>Expand to inspect the model output</span>
                </summary>
                {transcriptionParsed != null ? (
                  <JsonTree value={transcriptionParsed} />
                ) : (
                  <pre>{transcriptionText || "No transcription content yet."}</pre>
                )}
              </details>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
