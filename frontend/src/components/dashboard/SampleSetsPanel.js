"use client";

import {
  Icon,
  IconButton,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";

function sampleCount(sampleSet) {
  return Number(sampleSet?.sample_count ?? sampleSet?.sample_ids?.length ?? 0);
}

export function SampleSetsPanel({
  sampleSets,
  selectedSampleSetId,
  onSelectSampleSet,
  onDeleteSampleSet,
}) {
  return (
    <section className="dashboard-sample-sets" aria-labelledby="sample-sets-title">
      <header className="dashboard-catalog-heading">
        <h2 id="sample-sets-title">Sample sets</h2>
        <StatusBadge>{sampleSets.length}</StatusBadge>
      </header>
      <ul className="dashboard-sample-set-list">
        {sampleSets.map((sampleSet) => {
          const selected = Number(sampleSet.id) === Number(selectedSampleSetId);
          const samples = sampleCount(sampleSet);
          const workflows = Number(sampleSet.workflow_count || 0);
          return (
            <li
              key={sampleSet.id}
              className={`dashboard-sample-set-row${selected ? " is-selected" : ""}`}
            >
              <button
                type="button"
                className="dashboard-sample-set-select"
                aria-pressed={selected}
                onClick={() => onSelectSampleSet?.(Number(sampleSet.id))}
              >
                <span className="dashboard-sample-set-copy">
                  <strong>{sampleSet.name || "Sample set"}</strong>
                  <span>
                    {samples} {samples === 1 ? "sample" : "samples"} · {workflows}{" "}
                    {workflows === 1 ? "workflow" : "workflows"}
                  </span>
                </span>
                <span className="dashboard-sample-set-meta">
                  <StatusBadge>{sampleSet.status || "draft"}</StatusBadge>
                  <time dateTime={sampleSet.created_at || undefined}>
                    {formatDate(sampleSet.created_at) || "—"}
                  </time>
                </span>
              </button>
              <span className="dashboard-sample-set-actions">
                <IconButton
                  label={`Delete sample set ${sampleSet.name || sampleSet.id}`}
                  variant="danger"
                  onClick={() => onDeleteSampleSet?.(Number(sampleSet.id))}
                >
                  <Icon name="delete" />
                </IconButton>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
