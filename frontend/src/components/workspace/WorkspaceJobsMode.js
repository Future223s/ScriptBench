"use client";

import {
  Button,
  EmptyState,
  Inline,
  Panel,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { selectedJobIds } from "../../domains/workspace/selectors.js";
import { WorkspaceJobCard } from "./WorkspaceJobCard.js";

function JobPanel({ kind, title, jobs, selection, label, onAction, actions }) {
  const ids = selectedJobIds(selection, kind);
  return (
    <Panel
      title={title}
      meta={<StatusBadge>{jobs.length}</StatusBadge>}
      actions={
        <Inline gap="compact">
          <Button
            size="compact"
            onClick={() => actions?.selectVisibleWorkspaceJobs?.(kind)}
          >
            {ids.length === jobs.length && jobs.length ? "Clear" : "Select all"}
          </Button>
          <Button
            size="compact"
            variant="primary"
            disabled={!ids.length}
            onClick={onAction}
          >
            {label}
          </Button>
        </Inline>
      }
    >
      <Stack gap="compact">
        {jobs.length ? (
          jobs.map((job) => (
            <WorkspaceJobCard
              key={job.job_id}
              job={job}
              kind={kind}
              selected={ids.includes(Number(job.job_id))}
              onToggle={actions?.toggleWorkspaceJobSelection}
              onOpen={actions?.openJobDetail}
            />
          ))
        ) : (
          <EmptyState title={`No ${title.toLowerCase()}`} />
        )}
      </Stack>
    </Panel>
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
    <Stack>
      <JobPanel
        kind="pending"
        title="Pending jobs"
        jobs={pendingJobs}
        selection={jobSelection}
        label="Queue"
        onAction={actions?.queueSelectedJobs}
        actions={actions}
      />
      <JobPanel
        kind="queued"
        title="Queued jobs"
        jobs={queuedJobs}
        selection={jobSelection}
        label="Unqueue"
        onAction={actions?.unqueueSelectedJobs}
        actions={actions}
      />
      <JobPanel
        kind="completed"
        title="Completed jobs"
        jobs={completedJobs}
        selection={jobSelection}
        label="Retry"
        onAction={actions?.retrySelectedJobs}
        actions={actions}
      />
    </Stack>
  );
}
