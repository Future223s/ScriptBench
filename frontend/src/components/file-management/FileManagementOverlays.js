"use client";

import { EmptyState } from "../common/EmptyState.js";
import { membershipsForSample, normalizeGroupValue } from "../../utils/workflow.js";

function SampleDetailModal({ open, sample, groupings, actions }) {
  const memberships = sample
    ? [
        ...(sample.sample_group ? [{ group: "sample_group", value: normalizeGroupValue(sample.sample_group) }] : []),
        ...membershipsForSample(groupings, sample.sample_id),
      ]
    : [];
  const src = sample?.sample_blob_base64 && sample?.sample_mime_type && String(sample.sample_mime_type).startsWith("image/")
    ? `data:${sample.sample_mime_type};base64,${sample.sample_blob_base64}`
    : "";

  return (
    <div className={["modal-backdrop", open ? "" : "is-hidden"].filter(Boolean).join(" ")} data-modal="sample-detail">
      <section className="modal">
        <div className="modal-header">
          <div className="panel-title">
            <h2>{sample?.sample_id || "Sample"}</h2>
            <span>{sample?.sample_mime_type || ""}</span>
          </div>
          <div className="inline-actions">
            <button className="btn-danger" type="button" onClick={() => actions.deleteSample(sample?.sample_id || "")}>
              Delete sample
            </button>
            <button className="btn-ghost" type="button" onClick={actions.closeSampleDetail}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="sample-detail-grid">
            <div className="sample-preview">
              {src ? <img src={src} alt={sample.sample_id} /> : <EmptyState>No image preview available.</EmptyState>}
            </div>
            <div className="ground-truth-box">
              <h3>Ground truth</h3>
              <pre>{sample?.ground_truth_text || ""}</pre>
            </div>
          </div>
          <div className="membership-footer">
            <h3>Grouping values</h3>
            <div className="chip-list">
              {memberships.length ? (
                memberships.map((membership) => (
                  <span className="badge" key={`${membership.group}:${membership.value}`}>
                    {membership.group}: {membership.value}
                  </span>
                ))
              ) : (
                <span className="count-label">No grouping values yet.</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function FileManagementOverlays({ state, actions }) {
  return (
    <SampleDetailModal open={state.sampleDetailOpen} sample={state.selectedSample} groupings={state.groupings} actions={actions} />
  );
}
