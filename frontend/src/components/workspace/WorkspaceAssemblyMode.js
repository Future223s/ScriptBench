"use client";

import { formatMetric } from "../../utils/metrics.js";
import { aggregateMetrics } from "../../domains/workspace/metrics.js";
import { transcriptionOutputName } from "../../domains/workspace/transcription.js";
import { workflowStageLabel } from "../../domains/workspace/workflow.js";

export function WorkspaceAssemblyMode({ workspace, transcriptions = [], actions }) {
  const workflow = workspace?.workflow || {};
  const firstTranscription = transcriptions[0] || null;
  const summary = aggregateMetrics(transcriptions);
  const groups = Array.isArray(workflow.groups) ? workflow.groups : [];

  return (
    <section className="panel workspace-assembly-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>Assembly</h2>
          <span>Configure and persist transcription outputs</span>
        </div>
        <div className="toolbar">
          <button className="btn-secondary" type="button" onClick={actions?.assembleTranscriptions}>
            Assemble all
          </button>
          <button className="btn-primary" type="button" onClick={actions?.scoreWorkspace} disabled={!transcriptions.length}>
            Score all
          </button>
        </div>
      </div>
      <div className="workspace-assembly-copy">
        <div className="workspace-assembly-summary">
          <span className="badge">{workflowStageLabel(workspace)}</span>
          <span className="badge amber">{transcriptions.length} outputs</span>
          <span className="badge">{groups.length ? `${groups.length} grouping rule(s)` : "No grouping rules"}</span>
        </div>
        <p>
          {groups.length ? (
            <>
              Outputs partition by the workflow grouping rules:{" "}
              {groups.map((group, index) => (
                <span key={`${group}-${index}`}>
                  <code>{group}</code>
                  {index === groups.length - 1 ? "." : ", "}
                </span>
              ))}
            </>
          ) : (
            "Outputs map one-to-one from job output to transcription records."
          )}
        </p>
      </div>
      <div className="detail-grid">
        <div className="detail-card">
          <h3>Result summary</h3>
          <div className="metadata-grid">
            <div className="metadata-row">
              <span>Transcriptions</span>
              <strong>{transcriptions.length}</strong>
            </div>
            <div className="metadata-row">
              <span>Mean CER</span>
              <strong>{formatMetric(summary.cer?.mean)}</strong>
            </div>
            <div className="metadata-row">
              <span>Mean WER</span>
              <strong>{formatMetric(summary.wer?.mean)}</strong>
            </div>
            <div className="metadata-row">
              <span>Mean hallucinations</span>
              <strong>{formatMetric(summary.hallucinations?.mean)}</strong>
            </div>
          </div>
        </div>
        <div className="detail-card">
          <h3>Latest output</h3>
          {firstTranscription ? (
            <>
              <strong>{transcriptionOutputName(firstTranscription)}</strong>
              <pre>{String(firstTranscription.transcription_text || "").slice(0, 240)}</pre>
            </>
          ) : (
            <div className="empty-state">No transcriptions have been assembled yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
