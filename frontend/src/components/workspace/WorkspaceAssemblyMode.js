"use client";

import { formatMetric } from "../../utils/metrics.js";
import { aggregateMetrics } from "../../domains/workspace/metrics.js";
import { transcriptionOutputName } from "../../domains/workspace/transcription.js";
import { workflowStageLabel } from "../../domains/workspace/workflow.js";

export function WorkspaceAssemblyMode({ workspace, transcriptions = [], transcriptionSet = "default", actions }) {
  const firstTranscription = transcriptions[0] || null;
  const summary = aggregateMetrics(transcriptions);

  return (
    <section className="panel workspace-assembly-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>Assembly</h2>
          <span>Configure and persist transcription outputs</span>
        </div>
        <div className="toolbar">
          <div className="field" style={{ minWidth: "180px" }}>
            <label htmlFor="workspace-transcription-set">Transcription set</label>
            <select
              id="workspace-transcription-set"
              value={transcriptionSet}
              onChange={(event) => actions?.setWorkspaceTranscriptionSet?.(event.target.value)}
            >
              <option value="default">Default sample set</option>
            </select>
          </div>
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
          <span className="badge">Default set only</span>
        </div>
        <p>Completed jobs are assembled into transcription rows using sample IDs in job order.</p>
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
