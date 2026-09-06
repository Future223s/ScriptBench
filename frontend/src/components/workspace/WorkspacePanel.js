"use client";

import {
  Button,
  EmptyState,
  Inline,
  Panel,
  SelectableRow,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";

function columnRows(rows, column) {
  return rows.filter(
    (row) => String(row.status || "pending").toLowerCase() === column,
  );
}

function ExecutionColumn({
  column,
  title,
  rows,
  selectedIds,
  actions,
  actionLabel,
  onAction,
  loading,
}) {
  const visible = columnRows(rows, column);
  const allSelected =
    visible.length > 0 &&
    visible.every((row) => selectedIds.includes(String(row.execution_job_id)));
  return (
    <Panel
      density="compact"
      title={title}
      meta={<StatusBadge>{visible.length}</StatusBadge>}
      actions={
        <Inline gap="compact">
          <Button
            size="compact"
            onClick={() => actions.selectAllRows(column)}
            disabled={loading}
          >
            {allSelected ? "Clear" : "Select all"}
          </Button>
          {actionLabel ? (
            <Button
              size="compact"
              variant="primary"
              onClick={onAction}
              disabled={loading || !selectedIds.length}
            >
              {actionLabel}
            </Button>
          ) : null}
        </Inline>
      }
    >
      <Stack gap="compact">
        {visible.length ? (
          visible.map((row) => (
            <SelectableRow
              key={row.execution_job_id}
              title={`Sample ${row.sample_id}`}
              detail={
                row.error_message
                  ? `Failed: ${row.error_message}`
                  : row.next_step_name ||
                    (column === "completed" ? "Complete" : "Awaiting next step")
              }
              selected={selectedIds.includes(String(row.execution_job_id))}
              onSelectedChange={(checked) =>
                actions.toggleRowSelection(
                  column,
                  row.execution_job_id,
                  checked,
                )
              }
              action={
                <Button
                  size="compact"
                  onClick={() => actions.openRowDetail(row.execution_job_id)}
                  disabled={loading}
                >
                  Open
                </Button>
              }
            />
          ))
        ) : (
          <EmptyState title={`No ${title.toLowerCase()} rows`} />
        )}
      </Stack>
    </Panel>
  );
}

export function WorkspacePanel({
  workflow,
  rows = [],
  selection,
  loading,
  actions,
}) {
  const selected = selection || {
    pending: [],
    queued: [],
    running: [],
    completed: [],
  };
  return (
    <Stack>
      <Panel
        title={workflow?.workflow_name || "Workflow workspace"}
        description={workflow?.workflow_description}
        actions={
          <Inline gap="compact" align="end">
            <Button
              variant="primary"
              onClick={actions.startExecution}
              disabled={loading}
            >
              Start execution
            </Button>
            <Button onClick={actions.stopExecution} disabled={loading}>
              Stop execution
            </Button>
            <Button onClick={actions.openDashboard}>Switch workflow</Button>
          </Inline>
        }
      ></Panel>
      {loading ? (
        <EmptyState title="Loading execution rows" />
      ) : (
        <section className="workspace-execution-board">
          <ExecutionColumn
            column="pending"
            title="Pending"
            rows={rows}
            selectedIds={selected.pending}
            actions={actions}
            actionLabel="Queue"
            onAction={actions.queueSelectedRows}
            loading={loading}
          />
          <ExecutionColumn
            column="queued"
            title="Queued"
            rows={rows}
            selectedIds={selected.queued}
            actions={actions}
            actionLabel="Dequeue"
            onAction={actions.dequeueSelectedRows}
            loading={loading}
          />
          <ExecutionColumn
            column="running"
            title="Running"
            rows={rows}
            selectedIds={selected.running}
            actions={actions}
            loading={loading}
          />
          <ExecutionColumn
            column="completed"
            title="Completed"
            rows={rows}
            selectedIds={selected.completed}
            actions={actions}
            actionLabel="Retry"
            onAction={actions.retryCompletedJobs}
            loading={loading}
          />
        </section>
      )}
    </Stack>
  );
}
