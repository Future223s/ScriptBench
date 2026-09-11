"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceApi } from "../../api/endpoints/workspace.ts";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";

const initialSelection = {
  pending: [],
  queued: [],
  running: [],
  completed: [],
};

function initialState() {
  return {
    workflows: [],
    selectedWorkflowId: null,
    workspacePickerWorkflowId: null,
    selectedWorkflowSummary: null,
    rows: [],
    selectedRowIdsByColumn: initialSelection,
    loadingWorkflows: true,
    loadingWorkspace: false,
    applyingExecutionAction: false,
    workspaceError: "",
    workspaceNotice: "",
    liveRowUpdateStatus: "disconnected",
    selectedExecutionRowId: null,
    selectedExecutionRow: null,
    failureOverlay: null,
    acknowledgedFailureRowIds: [],
  };
}

function visibleRows(rows) {
  return rows || [];
}

function columnFor(row) {
  const status = String(row.status || "pending").toLowerCase();
  return ["pending", "queued", "running", "completed"].includes(status)
    ? status
    : "pending";
}

export function useWorkspacePage() {
  const router = useRouter();
  const { syncNotifications } = useNotificationOverlay() || {};
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const socketRef = useRef(null);
  const activeWorkflowRef = useRef(null);
  const switchingRef = useRef(false);

  function patchState(patch) {
    setState((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  }

  function closeSocket() {
    socketRef.current?.close();
    socketRef.current = null;
  }

  function applyRowsEvent({ event, message, rows }) {
    if (!Array.isArray(rows) || !rows.length) return;
    patchState((current) => {
      const changed = new Map(
        rows.map((row) => [String(row.id), row]),
      );
      const nextRows = current.rows.map((row) =>
        changed.has(String(row.id))
          ? { ...row, ...changed.get(String(row.id)) }
          : row,
      );
      for (const row of rows) {
        if (
          !current.rows.some(
            (item) =>
              String(item.id) === String(row.id),
          )
        )
          nextRows.push(row);
      }
      const failed = event === "FAILED" ? rows[0] : null;
      const next = { rows: nextRows };
      if (failed) {
        const errorMessage =
          failed.error_message || message || "The execution job failed.";
        next.failureOverlay = {
          ...failed,
          error_message: errorMessage,
          raw_payload: { event, message, rows },
        };
        next.workspaceError = `Execution job ${failed.id} failed: ${errorMessage}`;
      }
      return next;
    });
  }

  function connectEvents(workflowId) {
    const url = workspaceApi.getExecutionJobsEventsUrl(workflowId);
    if (!url) return;
    closeSocket();
    const socket = new WebSocket(url);
    socketRef.current = socket;
    patchState({ liveRowUpdateStatus: "connecting" });
    socket.onopen = () => { if (socketRef.current === socket) patchState({ liveRowUpdateStatus: "connected" }); };
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      try {
        applyRowsEvent(JSON.parse(event.data));
      } catch {
        /* Ignore malformed events. */
      }
    };
    socket.onerror = () => { if (socketRef.current === socket) patchState({ liveRowUpdateStatus: "error" }); };
    socket.onclose = () => { if (socketRef.current === socket) patchState({ liveRowUpdateStatus: "disconnected" }); };
  }

  function applyRows(rows, patch = {}) {
    patchState((current) => {
      const acknowledgedFailureRowIds = current.acknowledgedFailureRowIds || [];
      const failedRow = rows.find(
        (row) =>
          row.error_message &&
          !acknowledgedFailureRowIds.some(
            (id) => String(id) === String(row.id),
          ),
      );
      return {
        rows,
        ...patch,
        ...(failedRow && !current.failureOverlay
          ? {
              failureOverlay: failedRow,
              workspaceError: `Execution job ${failedRow.id} failed: ${failedRow.error_message}`,
            }
          : {}),
      };
    });
  }

  async function refreshRows(workflowId) {
    const rows = visibleRows(await workspaceApi.getExecutionJobs(workflowId));
    if (String(activeWorkflowRef.current) === String(workflowId)) applyRows(rows);
    return rows;
  }

  async function refreshUntilSettled(workflowId) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (String(activeWorkflowRef.current) !== String(workflowId)) return;
      const rows = await refreshRows(workflowId);
      if (!rows.some((row) => ["queued", "running"].includes(row.status))) {
        return;
      }
    }
  }

  async function loadWorkflows() {
    patchState({ loadingWorkflows: true, workspaceError: "" });
    try {
      const response = await workspaceApi.getWorkflows();
      patchState({
        workflows: response.workflows || [],
        loadingWorkflows: false,
      });
    } catch (error) {
      patchState({
        workflows: [],
        loadingWorkflows: false,
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function switchWorkflow() {
    if (switchingRef.current || stateRef.current.applyingExecutionAction) return;
    const workflowId = activeWorkflowRef.current;
    if (!workflowId) return;
    switchingRef.current = true;
    patchState({ applyingExecutionAction: true, workspaceError: "" });
    try {
      await workspaceApi.stopExecution(workflowId);
      activeWorkflowRef.current = null;
      closeSocket();
      patchState({
        selectedWorkflowId: null, selectedWorkflowSummary: null,
        workspacePickerWorkflowId: workflowId, rows: [],
        selectedRowIdsByColumn: initialSelection,
        selectedExecutionRowId: null, selectedExecutionRow: null,
        failureOverlay: null, acknowledgedFailureRowIds: [],
        workspaceNotice: "", liveRowUpdateStatus: "disconnected",
      });
    } catch (exc) {
      patchState({ workspaceError: exc instanceof Error ? exc.message : String(exc) });
    } finally {
      switchingRef.current = false;
      patchState({ applyingExecutionAction: false });
    }
  }

  async function openWorkflowWorkspace(workflowId) {
    if (switchingRef.current) return;
    const workflow = stateRef.current.workflows.find(
      (item) => String(item.id) === String(workflowId),
    );
    if (!workflow) return patchState({ workspaceError: "Select a workflow first." });
    switchingRef.current = true;
    patchState({ loadingWorkspace: true, workspaceError: "" });
    try {
      const previousId = activeWorkflowRef.current;
      if (previousId && String(previousId) !== String(workflow.id)) {
        await workspaceApi.stopExecution(previousId);
      }
      // The worker may already be scheduling other workflows; opening is not Start.
      await workspaceApi.stopExecution(workflow.id);
      activeWorkflowRef.current = workflow.id;
      closeSocket();
      patchState({
        selectedWorkflowId: workflow.id,
        selectedWorkflowSummary: workflow,
        rows: [], selectedRowIdsByColumn: initialSelection,
        workspaceNotice: "", failureOverlay: null, acknowledgedFailureRowIds: [],
        selectedExecutionRowId: null, selectedExecutionRow: null,
      });
      const rows = visibleRows(await workspaceApi.getExecutionJobs(workflow.id));
      applyRows(rows, { loadingWorkspace: false });
      connectEvents(workflow.id);
    } catch (exc) {
      patchState({ loadingWorkspace: false, workspaceError: exc instanceof Error ? exc.message : String(exc) });
    } finally {
      switchingRef.current = false;
      patchState({ loadingWorkspace: false });
    }
  }

  function setWorkflowId(workflowId) {
    patchState({ workspacePickerWorkflowId: workflowId || null });
  }

  async function startExecution() {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) return;
    patchState({ applyingExecutionAction: true, workspaceError: "" });
    try {
      await workspaceApi.startExecution(workflowId);
      if (String(activeWorkflowRef.current) !== String(workflowId)) return;
      const rows = await refreshRows(workflowId);
      patchState({ applyingExecutionAction: false });
      if (rows.some((row) => ["queued", "running"].includes(row.status))) {
        void refreshUntilSettled(workflowId).catch(() => {
          /* Live events remain the fast path if polling cannot refresh. */
        });
      }
    } catch (error) {
      patchState({
        applyingExecutionAction: false,
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function stopExecution() {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) return;
    patchState({ applyingExecutionAction: true, workspaceError: "" });
    try {
      await workspaceApi.stopExecution(workflowId);
      patchState({ applyingExecutionAction: false });
    } catch (error) {
      patchState({
        applyingExecutionAction: false,
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function resolveFailure(action) {
    const workflowId = stateRef.current.selectedWorkflowId;
    const rowId = stateRef.current.failureOverlay?.id;
    if (!workflowId || !rowId) return;
    patchState({ applyingExecutionAction: true, workspaceError: "" });
    try {
      await workspaceApi.acknowledgeFailure(workflowId, rowId, action);
      const rows = visibleRows(await workspaceApi.getExecutionJobs(workflowId));
      patchState({
        rows,
        failureOverlay: null,
        acknowledgedFailureRowIds: [
          ...(stateRef.current.acknowledgedFailureRowIds || []),
          rowId,
        ],
        applyingExecutionAction: false,
      });
    } catch (error) {
      patchState({
        applyingExecutionAction: false,
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function toggleRowSelection(column, rowId, selected) {
    patchState((current) => {
      const currentIds = current.selectedRowIdsByColumn[column] || [];
      const id = String(rowId);
      const ids = selected
        ? [...new Set([...currentIds, id])]
        : currentIds.filter((value) => value !== id);
      return {
        selectedRowIdsByColumn: {
          ...current.selectedRowIdsByColumn,
          [column]: ids,
        },
      };
    });
  }

  function selectAllRows(column) {
    const ids = stateRef.current.rows
      .filter((row) => columnFor(row) === column)
      .map((row) => String(row.id));
    patchState((current) => ({
      selectedRowIdsByColumn: {
        ...current.selectedRowIdsByColumn,
        [column]:
          current.selectedRowIdsByColumn[column]?.length === ids.length
            ? []
            : ids,
      },
    }));
  }

  async function applyAction(action, column) {
    const workflowId = stateRef.current.selectedWorkflowId;
    const ids = stateRef.current.selectedRowIdsByColumn[column] || [];
    if (!workflowId || !ids.length) return;
    patchState({
      applyingExecutionAction: true,
      workspaceError: "",
      workspaceNotice: "",
    });
    try {
      const response =
        action === "queue"
          ? await workspaceApi.queueExecutionJobs(workflowId, ids)
          : action === "dequeue"
            ? await workspaceApi.dequeueExecutionJobs(workflowId, ids)
            : await workspaceApi.retryCompletedExecutionJobs(workflowId, ids);
      const rows = visibleRows(await workspaceApi.getExecutionJobs(workflowId));
      const count = Number(
        response?.data?.[
          action === "dequeue" ? "dequeued_count" : "queued_count"
        ] || 0,
      );
      patchState({
        rows,
        selectedRowIdsByColumn: initialSelection,
        applyingExecutionAction: false,
        workspaceError:
          count === 0
            ? `No jobs were ${action === "dequeue" ? "dequeued" : "queued"}.`
            : "",
        workspaceNotice:
          count > 0
            ? `${count} job${count === 1 ? "" : "s"} ${action === "dequeue" ? "dequeued" : "queued"}.`
            : "",
      });
    } catch (error) {
      patchState({
        applyingExecutionAction: false,
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openRowDetail(rowId) {
    const workflowId = stateRef.current.selectedWorkflowId;
    const row = stateRef.current.rows.find(
      (item) => String(item.id) === String(rowId),
    );
    if (!workflowId || !row) return;
    patchState({ selectedExecutionRowId: rowId, selectedExecutionRow: row });
    try {
      const detail = await workspaceApi.getExecutionJobDetail(workflowId, rowId);
      if (
        String(stateRef.current.selectedWorkflowId) === String(workflowId) &&
        String(stateRef.current.selectedExecutionRowId) === String(rowId)
      ) {
        patchState({ selectedExecutionRow: detail });
      }
    } catch (error) {
      if (
        String(stateRef.current.selectedWorkflowId) === String(workflowId) &&
        String(stateRef.current.selectedExecutionRowId) === String(rowId)
      ) {
        patchState({
          workspaceError:
            error instanceof Error
              ? error.message
              : "Could not load execution job details.",
        });
      }
    }
  }

  function closeRowDetail() {
    patchState({ selectedExecutionRowId: null, selectedExecutionRow: null });
  }
  function closeFailureOverlay() {
    patchState({ failureOverlay: null });
  }

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    void loadWorkflows();
    return () => { activeWorkflowRef.current = null; closeSocket(); };
  }, []);
  useEffect(() => {
    syncNotifications?.("workspace-page", [
      { kind: "error", message: state.workspaceError },
      { kind: "success", message: state.workspaceNotice },
    ]);
  }, [state.workspaceError, state.workspaceNotice, syncNotifications]);

  return {
    state,
    rootRef: useRef(null),
    actions: {
      openDashboard: () => router.push("/dashboard"),
      setWorkspacePickerWorkflowId: setWorkflowId,
      openSelectedWorkflow: () =>
        void openWorkflowWorkspace(stateRef.current.workspacePickerWorkflowId),
      openWorkflowWorkspace,
      switchWorkflow,
      startExecution,
      stopExecution,
      toggleRowSelection,
      selectAllRows,
      queueSelectedRows: () => void applyAction("queue", "pending"),
      dequeueSelectedRows: () => void applyAction("dequeue", "queued"),
      retryCompletedJobs: () => void applyAction("retry", "completed"),
      openRowDetail,
      closeRowDetail,
      closeFailureOverlay,
      retryFailure: () => void resolveFailure("retry"),
      stopFailureExecution: () => void resolveFailure("stop_execution"),
    },
  };
}
