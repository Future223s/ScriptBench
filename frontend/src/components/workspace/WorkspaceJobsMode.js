"use client";

import { selectedJobIds } from "../../domains/workspace/selectors.js";
import { WorkspaceJobCard } from "./WorkspaceJobCard.js";

function WorkspaceJobPanel({
  kind,
  title,
  description,
  jobs,
  selection,
  primaryActionLabel,
  onPrimaryAction,
  onSelectAll,
  onToggleJobSelection,
  onOpenJob,
}) {
  const selectedIds = selectedJobIds(selection, kind);
  const selectedCount = selectedIds.length;
  const allSelected = jobs.length > 0 && selectedCount === jobs.length;

  return (
    <section className="panel workspace-job-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>{title}</h2>
          <span>{description}</span>
        </div>
      </div>
      <div className="workspace-panel-toolbar">
        <button
          className={`btn-${allSelected ? "secondary" : "ghost"} btn-tight`}
          type="button"
          onClick={() => onSelectAll?.(kind)}
          aria-pressed={allSelected ? "true" : "false"}
        >
          {allSelected ? "Unselect all" : "Select all"}
        </button>
        <button className="btn-primary btn-tight" type="button" onClick={onPrimaryAction} disabled={!selectedCount}>
          {primaryActionLabel}
        </button>
      </div>
      <div className="workspace-job-list" data-preserve-scroll-key={`workspace-job-list-${kind}`}>
        {jobs.length ? (
          jobs.map((job) => (
            <WorkspaceJobCard
              key={job.job_id}
              job={job}
              kind={kind}
              selected={selectedIds.includes(Number(job.job_id))}
              onToggle={onToggleJobSelection}
              onOpen={onOpenJob}
            />
          ))
        ) : (
          <div className="empty-state">No {title.toLowerCase()} yet.</div>
        )}
      </div>
    </section>
  );
}

export function WorkspaceJobsMode({
  pendingJobs = [],
  queuedJobs = [],
  completedJobs = [],
  jobSelection = {},
  actions,
}) {
  return (
    <section className="workspace-execution-grid">
      <div className="workspace-job-grid">
        <WorkspaceJobPanel
          kind="pending"
          title="Pending jobs"
          description="Ready to queue and send to model."
          jobs={pendingJobs}
          selection={jobSelection}
          primaryActionLabel="Queue selected"
          onPrimaryAction={actions?.queueSelectedJobs}
          onSelectAll={actions?.selectVisibleWorkspaceJobs}
          onToggleJobSelection={actions?.toggleWorkspaceJobSelection}
          onOpenJob={actions?.openJobDetail}
        />
        <WorkspaceJobPanel
          kind="queued"
          title="Queued jobs"
          description="In flight or waiting on execution."
          jobs={queuedJobs}
          selection={jobSelection}
          primaryActionLabel="Unqueue selected"
          onPrimaryAction={actions?.unqueueSelectedJobs}
          onSelectAll={actions?.selectVisibleWorkspaceJobs}
          onToggleJobSelection={actions?.toggleWorkspaceJobSelection}
          onOpenJob={actions?.openJobDetail}
        />
        <WorkspaceJobPanel
          kind="completed"
          title="Completed jobs"
          description="Finished jobs which can be retried."
          jobs={completedJobs}
          selection={jobSelection}
          primaryActionLabel="Retry selected"
          onPrimaryAction={actions?.retrySelectedJobs}
          onSelectAll={actions?.selectVisibleWorkspaceJobs}
          onToggleJobSelection={actions?.toggleWorkspaceJobSelection}
          onOpenJob={actions?.openJobDetail}
        />
      </div>
    </section>
  );
}
