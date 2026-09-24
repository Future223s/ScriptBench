"use client";

import {
  Button,
  DataTable,
  Inline,
  Panel,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { selectedJobIds } from "../../domains/workspace/selectors.js";
import { formatDate } from "../../utils/date.js";

const jobColumns = [
  {
    id: "job",
    label: "Job",
    width: "14%",
    className: "ui-data-table__primary",
    render: (job) => `Job ${job.job_id}`,
  },
  {
    id: "samples",
    label: "Samples",
    width: "28%",
    render: (job) =>
      Array.isArray(job.sample_ids) && job.sample_ids.length
        ? job.sample_ids.join(", ")
        : "—",
  },
  {
    id: "status",
    label: "Status",
    width: "16%",
    render: (job) => <StatusBadge>{job.status || "pending"}</StatusBadge>,
  },
  {
    id: "issue",
    label: "Next step / issue",
    width: "24%",
    render: (job) => job.failure_reason || job.next_step_name || "—",
  },
  {
    id: "created",
    label: "Created",
    width: "18%",
    render: (job) => formatDate(job.created_at) || "—",
  },
];

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
      className="workspace-job-panel"
    >
      <DataTable
        ariaLabel={title}
        columns={jobColumns}
        rows={jobs}
        getRowId={(job) => job.job_id}
        getRowLabel={(job) => `Job ${job.job_id}`}
        selectedRowIds={ids}
        onRowActivate={(job) => actions?.openJobDetail?.(job.job_id)}
        onRowSelectedChange={(job, selected) =>
          actions?.toggleWorkspaceJobSelection?.(kind, job.job_id, selected)
        }
        emptyState={`No ${title.toLowerCase()} are available.`}
      />
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
