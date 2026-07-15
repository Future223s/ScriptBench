"use client";

import { selectedJobIds } from "../../domains/workspace/selectors.js";
import { workflowStageLabel } from "../../domains/workspace/workflow.js";
import { WorkspaceAssemblyMode } from "./WorkspaceAssemblyMode.js";
import { WorkspaceJobsMode } from "./WorkspaceJobsMode.js";
import { WorkspaceReviewMode } from "./WorkspaceReviewMode.js";

function WorkspaceMetricTile({ label, value, caption, tone = "neutral" }) {
  const number = Number(value);
  const displayValue = Number.isFinite(number) ? (Number.isInteger(number) ? String(number) : number.toFixed(3)) : "n/a";

  return (
    <div className={`metric-tile ${tone}`}>
      <span>{label}</span>
      <strong>{displayValue}</strong>
      <small>{caption || "No scores yet"}</small>
    </div>
  );
}

function WorkspacePaneButton({ active, pane, onSelect }) {
  return (
    <button
      className={`workspace-stage-card ${active ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelect(pane.key)}
      aria-pressed={active ? "true" : "false"}
    >
      <span className="workspace-stage-card-title">{pane.title}</span>
      <span className="workspace-stage-card-description">{pane.description}</span>
    </button>
  );
}

export function WorkspacePanel({
  workspace,
  loading,
  activePane = "jobs",
  transcriptionSet = "default",
  jobSelection = {},
  reviewQuery = "",
  reviewSort = "score",
  selectedTranscriptionId = null,
  selectedTranscription: selectedTranscriptionDetail = null,
  reviewCompareExpanded = false,
  actions,
}) {
  const pendingJobs = Array.isArray(workspace?.pending_jobs) ? workspace.pending_jobs : [];
  const queuedJobs = Array.isArray(workspace?.queued_jobs) ? workspace.queued_jobs : [];
  const completedJobs = Array.isArray(workspace?.completed_jobs) ? workspace.completed_jobs : [];
  const transcriptions = Array.isArray(workspace?.transcriptions) ? workspace.transcriptions : [];
  const pendingSelected = selectedJobIds(jobSelection, "pending");
  const queuedSelected = selectedJobIds(jobSelection, "queued");
  const completedSelected = selectedJobIds(jobSelection, "completed");
  const currentPane = ["jobs", "assembly", "review"].includes(activePane) ? activePane : "jobs";

  return (
    <section className="workspace-shell">
      <section className="panel workspace-header-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h2>{workspace?.workflow?.workflow_name || "Workflow workspace"}</h2>
            <span>
              {workflowStageLabel(workspace)}
              {workspace?.workflow?.model_family ? ` | ${workspace.workflow.model_family}` : ""}
              {workspace?.workflow?.model ? ` | ${workspace.workflow.model}` : ""}
            </span>
          </div>
          <WorkspaceMetricTile label="Pending" value={pendingJobs.length} caption={`${pendingSelected.length} selected`} tone="amber" />
          <WorkspaceMetricTile label="Queued" value={queuedJobs.length} caption={`${queuedSelected.length} selected`} tone="amber" />
          <WorkspaceMetricTile label="Completed" value={completedJobs.length} caption={`${completedSelected.length} selected`} tone="good" />
          <WorkspaceMetricTile label="Transcriptions" value={transcriptions.length} caption={`${transcriptions.length} reviewable`} tone="good" />
          <div className="toolbar">
            <button className="btn-secondary" type="button" onClick={actions?.createWorkspaceJobs}>
              Generate jobs
            </button>
            <button className="btn-danger" type="button" onClick={() => actions?.deleteWorkspaceJobs?.("all")}>
              Delete jobs
            </button>
          </div>
        </div>
      </section>

      <div className="workspace-layout">
        <aside className="panel workspace-sidebar">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Stages</h2>
              <span>Jobs, assembly, and review</span>
            </div>
          </div>
          <div className="workspace-stage-nav">
            {[
              { key: "jobs", title: "Jobs", description: "Monitor pending, queued, and completed jobs." },
              { key: "assembly", title: "Assembly", description: "Assemble and score transcriptions." },
              { key: "review", title: "Review", description: "Search, sort, and inspect outputs." },
            ].map((pane) => (
              <WorkspacePaneButton key={pane.key} active={currentPane === pane.key} pane={pane} onSelect={actions?.setWorkspacePane} />
            ))}
          </div>
          <div className="workspace-sidebar-copy">
            <div className="count-label">
              The stage rail borrows the card language from the dashboard so the new screen still feels native to ScriptBench.
            </div>
          </div>
        </aside>

        <main className="workspace-main">
          {loading ? <div className="empty-state">Loading workspace...</div> : null}

          {currentPane === "jobs" ? (
            <WorkspaceJobsMode
              pendingJobs={pendingJobs}
              queuedJobs={queuedJobs}
              completedJobs={completedJobs}
              jobSelection={jobSelection}
              actions={actions}
            />
          ) : null}

          {currentPane === "assembly" ? (
            <WorkspaceAssemblyMode
              workspace={workspace}
              transcriptions={transcriptions}
              transcriptionSet={transcriptionSet}
              actions={actions}
            />
          ) : null}

          {currentPane === "review" ? (
            <WorkspaceReviewMode
              transcriptions={transcriptions}
              selectedTranscriptionId={selectedTranscriptionId}
              selectedTranscription={selectedTranscriptionDetail}
              reviewQuery={reviewQuery}
              reviewSort={reviewSort}
              reviewCompareExpanded={reviewCompareExpanded}
              actions={actions}
            />
          ) : null}
        </main>
      </div>
    </section>
  );
}
