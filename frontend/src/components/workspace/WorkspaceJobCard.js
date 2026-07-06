"use client";

import { formatDate } from "../../utils/date.js";

function getJobStatusMessage(job, kind) {
  const status = String(job?.status || kind || "pending").toLowerCase();
  if (status === "running") return "Model request sent.";
  if (status === "completed") return "Transcription completed.";
  if (status === "failed") return String(job?.failure_reason || "Transcription failed.");
  if (status === "queued") return "Waiting for the worker.";
  return "";
}

export function WorkspaceJobCard({ job, kind, selected, onToggle, onOpen }) {
  const sampleIds = Array.isArray(job?.sample_ids) ? job.sample_ids.map((sampleId) => String(sampleId)).filter(Boolean) : [];
  const samplePreview = sampleIds.length ? sampleIds.join(", ") : "No sample ids";
  const status = String(job?.status || kind || "pending").toLowerCase();
  const statusMessage = getJobStatusMessage(job, kind);

  return (
    <article className={`workspace-job-card ${kind} status-${status} ${selected ? "is-selected" : ""}`}>
      <label className="workspace-job-select" title={selected ? "Unselect job" : "Select job"}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggle?.(kind, job.job_id, event.target.checked)}
        />
        <span className="workspace-job-check" aria-hidden="true">
          {selected ? "x" : ""}
        </span>
      </label>
      <button className="workspace-job-main" type="button" onClick={() => onOpen?.(job.job_id)}>
        <strong>Job {job.job_id}</strong>
        <span className="workspace-job-date">{formatDate(job?.created_at)}</span>
        <p className="workspace-job-preview">{samplePreview}</p>
        {statusMessage ? <p className="workspace-job-message">{statusMessage}</p> : null}
      </button>
    </article>
  );
}
