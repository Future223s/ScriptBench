"use client";

import {
  Button,
  CanvasEdge,
  CanvasNode,
  CanvasSurface,
  EmptyState,
  Inline,
  PageHeader,
  Panel,
  Stack,
  StackedSelect,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";

function columnRows(rows, column) {
  return rows.filter(
    (row) => String(row.status || "pending").toLowerCase() === column,
  );
}

function ExecutionRow({ row, column, selected, actions, loading }) {
  const nextStep = row.error_message
    ? row.error_message
    : row.next_step_name ||
      (column === "completed" ? "Execution complete" : "Awaiting next step");
  const timestamp = formatDate(row.updated_at || row.created_at) || "No timestamp";

  return (
    <div
      className={`workspace-execution-row${selected ? " is-selected" : ""}`}
    >
      <input
        type="checkbox"
        className="ui-choice__control"
        checked={selected}
        onChange={(event) =>
          actions.toggleRowSelection(column, row.id, event.target.checked)
        }
        aria-label={`Select ${row.target_label || row.sample_id || `job ${row.id}`}`}
        disabled={loading}
      />
      <button
        type="button"
        className="workspace-execution-row__open"
        onClick={() => actions.openRowDetail(row.id)}
        disabled={loading}
      >
        <strong>{row.target_label || row.sample_id || `Job ${row.id}`}</strong>
        <StatusBadge>{row.status || column}</StatusBadge>
        <span
          className={
            row.error_message ? "workspace-execution-row__error" : undefined
          }
        >
          {nextStep}
        </span>
        <time dateTime={row.updated_at || row.created_at || undefined}>
          {timestamp}
        </time>
      </button>
    </div>
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
    visible.every((row) => selectedIds.includes(String(row.id)));
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
      <div className="workspace-execution-list">
        {visible.length ? (
          visible.map((row) => (
            <ExecutionRow
              key={row.id}
              row={row}
              column={column}
              selected={selectedIds.includes(String(row.id))}
              actions={actions}
              loading={loading}
            />
          ))
        ) : (
          <EmptyState title={`No ${title.toLowerCase()} rows`} />
        )}
      </div>
    </Panel>
  );
}

export function WorkspacePanel({
  workflows = [],
  selectedWorkflowId,
  workflow,
  graph,
  selectedNodeId,
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
      <PageHeader
        title="Workspace"
        description={
          [workflow?.name, workflow?.description].filter(Boolean).join(" · ") ||
          "Monitor and control workflow execution."
        }
        controls={
          <StackedSelect
            label="Workflow"
            value={selectedWorkflowId ?? ""}
            onChange={(event) => actions.openWorkflowWorkspace(event.target.value)}
            disabled={loading || !workflows.length}
            aria-label="Select workflow"
          >
            {!workflows.length ? <option value="">No workflows available</option> : null}
            {workflows.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </StackedSelect>
        }
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
          </Inline>
        }
      />
      <ExecutionGraph
        graph={graph}
        selectedNodeId={selectedNodeId}
        actions={actions}
        loading={loading}
      />
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

function ExecutionGraph({ graph, selectedNodeId, actions, loading }) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  if (!nodes.length) return <EmptyState title="No resolved execution graph" />;
  const minRow = Math.min(...nodes.map((node) => Number(node.row)));
  const maxRow = Math.max(...nodes.map((node) => Number(node.row)));
  const minCol = Math.min(...nodes.map((node) => Number(node.col)));
  const maxCol = Math.max(...nodes.map((node) => Number(node.col)));
  const rows = Math.max(1, maxRow - minRow + 1);
  const cols = Math.max(1, maxCol - minCol + 1);
  const point = (node) => ({
    x: ((Number(node.col) - minCol + 0.5) / cols) * 100,
    y: ((Number(node.row) - minRow + 0.5) / rows) * 100,
  });
  const byId = new Map(nodes.map((node) => [Number(node.workflow_dag_node_id), node]));
  const selected = byId.get(Number(selectedNodeId));
  return (
    <Panel
      title="Resolved execution graph"
      description={graph?.run?.execution_mode === "stage_by_stage" ? "Stage-by-stage" : "End-to-end"}
      actions={selected ? (
        <Inline gap="compact">
          <Button size="compact" variant="primary" onClick={actions.queueSelectedNode} disabled={loading || !selected.released}>
            Queue all
          </Button>
          <Button size="compact" onClick={selected.released ? actions.holdSelectedNode : actions.releaseSelectedNode} disabled={loading}>
            {selected.released ? "Hold node" : "Release node"}
          </Button>
        </Inline>
      ) : null}
    >
      <CanvasSurface label="Resolved execution graph" size="compact">
        {edges.map((edge) => {
          const from = byId.get(Number(edge.from_workflow_dag_node_id));
          const to = byId.get(Number(edge.to_workflow_dag_node_id));
          if (!from || !to) return null;
          const a = point(from);
          const b = point(to);
          return <CanvasEdge key={edge.id} fromX={a.x} fromY={a.y} toX={b.x} toY={b.y} />;
        })}
        {nodes.map((node) => {
          const position = point(node);
          return (
            <CanvasNode
              key={node.workflow_dag_node_id}
              x={position.x}
              y={position.y}
              title={node.step_name}
              detail={`Stage ${node.topological_depth} · ${node.execution_scope} → ${node.output_scope} · B ${node.blocked} · P ${node.pending} · Q ${node.queued} · R ${node.running}${node.released ? "" : " · held"}`}
              selected={Number(selectedNodeId) === Number(node.workflow_dag_node_id)}
              onClick={() => actions.selectExecutionNode(node.workflow_dag_node_id)}
            />
          );
        })}
      </CanvasSurface>
    </Panel>
  );
}
