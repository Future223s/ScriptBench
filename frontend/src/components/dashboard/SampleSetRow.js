"use client";

import { Badge } from "../common/Badge.js";

function SampleSetGlyph() {
  return (
    <span className="icon-badge workflow-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 8h14M5 12h14M5 16h9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M7 4.8 4 6.4v10.8l3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V6.4l-3-1.6-3 1.6-3-1.6-3 1.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SampleSetRow({ sampleSet, selected = false, onSelect, onDelete }) {
  const sampleCount = Number(sampleSet?.sample_count ?? 0);
  const workflowCount = Number(sampleSet?.workflow_count ?? 0);
  const sampleSetName = sampleSet?.sample_set_name || "Sample set";

  return (
    <div className={["workflow-card", selected ? "is-selected" : ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="workflow-card-button"
        onClick={onSelect}
        title="View sample set analytics"
      >
        <SampleSetGlyph />
        <div className="workflow-card-body">
          <strong>{sampleSetName}</strong>
          <div className="meta-line sample-set-meta-line">
            <Badge>{sampleCount} samples</Badge>
            <Badge className="amber">{workflowCount} workflows</Badge>
          </div>
        </div>
      </button>
      <div className="workflow-card-actions">
        <button
          className="btn-danger btn-tight icon-delete-button"
          type="button"
          onClick={onDelete}
          aria-label={`Delete sample set ${sampleSetName}`}
          title="Delete sample set"
        >
          <TrashGlyph />
        </button>
      </div>
    </div>
  );
}
