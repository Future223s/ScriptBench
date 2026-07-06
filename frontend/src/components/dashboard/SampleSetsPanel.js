"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { SampleSetRow } from "./SampleSetRow.js";

export function SampleSetsPanel({ sampleSets, selectedSampleSetId, onSelectSampleSet, onDeleteSampleSet }) {
  return (
    <Panel className="sample-sets-panel">
      <div className="panel-header">
        <div className="panel-title panel-title-widget">
          <div className="panel-title-copy">
            <h2>Sample sets</h2>
            <span>These sets now anchor workflows and analytics</span>
          </div>
        </div>
        <span className="badge badge-stack">
          <span className="icon-badge badge-icon" aria-hidden="true">
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
          <span className="badge-stack-copy">
            <strong>{sampleSets.length}  </strong> sets
          </span>
        </span>
      </div>

      <div className="workflow-list">
        {sampleSets.length ? (
          sampleSets.map((sampleSet) => (
            <SampleSetRow
              key={sampleSet.sample_set_id}
              sampleSet={sampleSet}
              selected={Number(sampleSet.sample_set_id) === Number(selectedSampleSetId)}
              onSelect={() => onSelectSampleSet?.(Number(sampleSet.sample_set_id))}
              onDelete={() => onDeleteSampleSet?.(Number(sampleSet.sample_set_id))}
            />
          ))
        ) : (
          <EmptyState>No sample sets yet.</EmptyState>
        )}
      </div>
    </Panel>
  );
}
