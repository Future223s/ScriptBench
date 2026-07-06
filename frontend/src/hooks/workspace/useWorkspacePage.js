"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { workspaceApi } from "../../api/endpoints/workspace.ts";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";

function initialWorkspaceState() {
  return {
    loading: true,
    error: "",
    notice: "",
    workflows: [],
    selectedWorkflowId: null,
    workspacePickerWorkflowId: null,
    workspace: null,
    workspaceLoading: false,
    workspaceError: "",
    workspaceActionStatus: "",
    workspacePane: "jobs",
    workspaceJobSelection: { pending: [], queued: [], completed: [] },
    workspaceReviewQuery: "",
    workspaceReviewSort: "score",
    workspaceReviewCompareExpanded: false,
    selectedWorkspaceTranscriptionId: null,
    selectedWorkspaceTranscription: null,
    selectedJob: null,
    jobDetailOpen: false,
  };
}

export function useWorkspacePage() {
  const router = useRouter();
  const { syncNotifications } = useNotificationOverlay() || {};
  const [state, setState] = useState(() => initialWorkspaceState());
  const stateRef = useRef(state);
  const rootRef = useRef(null);
  const scrollPositionsRef = useRef(new Map());
  const workspaceEventSocketRef = useRef(null);
  const workspaceEventReconnectTimerRef = useRef(null);

  function captureWorkspaceScrollPositions() {
    const root = rootRef.current;
    const positions = new Map();
    if (root instanceof HTMLElement) {
      root.querySelectorAll("[data-preserve-scroll-key]").forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        const key = element.dataset.preserveScrollKey;
        if (!key) return;
        positions.set(key, element.scrollTop);
      });
    }
    scrollPositionsRef.current = positions;
  }

  function patchState(patch) {
    captureWorkspaceScrollPositions();
    setState((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  }

  function resetWorkspaceState({ keepSelectedWorkflowId = true, preserveWorkspaceUi = false } = {}) {
    const current = stateRef.current;
    return {
      selectedWorkflowId: keepSelectedWorkflowId ? current.selectedWorkflowId : null,
      workspace: null,
      workspaceLoading: false,
      workspaceError: "",
      workspacePane: preserveWorkspaceUi ? current.workspacePane : "jobs",
      workspaceJobSelection: { pending: [], queued: [], completed: [] },
      workspaceReviewQuery: preserveWorkspaceUi ? current.workspaceReviewQuery : "",
      workspaceReviewSort: preserveWorkspaceUi ? current.workspaceReviewSort : "score",
      workspaceReviewCompareExpanded: preserveWorkspaceUi ? current.workspaceReviewCompareExpanded : false,
      selectedWorkspaceTranscriptionId: null,
      selectedWorkspaceTranscription: null,
      selectedJob: null,
      jobDetailOpen: false,
      workspaceActionStatus: "",
    };
  }

  function workspaceJobSelection(status) {
    const selection = stateRef.current.workspaceJobSelection || {};
    return Array.isArray(selection[status]) ? selection[status] : [];
  }

  function workspaceJobsByKind(kind) {
    const workspace = stateRef.current.workspace || {};
    if (kind === "pending") return Array.isArray(workspace.pending_jobs) ? workspace.pending_jobs : [];
    if (kind === "queued") return Array.isArray(workspace.queued_jobs) ? workspace.queued_jobs : [];
    if (kind === "completed") return Array.isArray(workspace.completed_jobs) ? workspace.completed_jobs : [];
    return [];
  }

  function closeWorkspaceEventSocket() {
    if (workspaceEventReconnectTimerRef.current != null) {
      window.clearTimeout(workspaceEventReconnectTimerRef.current);
      workspaceEventReconnectTimerRef.current = null;
    }
    if (workspaceEventSocketRef.current) {
      const socket = workspaceEventSocketRef.current;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      workspaceEventSocketRef.current = null;
    }
  }

  function scheduleWorkspaceEventReconnect() {
    if (!stateRef.current.selectedWorkflowId || workspaceEventReconnectTimerRef.current != null) return;
    workspaceEventReconnectTimerRef.current = window.setTimeout(() => {
      workspaceEventReconnectTimerRef.current = null;
      void connectWorkspaceEventSocket();
    }, 1500);
  }

  function patchWorkspaceJob(jobPayload) {
    const jobId = Number(jobPayload?.job_id);
    if (!Number.isFinite(jobId)) return;

    patchState((current) => {
      const replaceJob = (jobs) =>
        jobs.map((job) => (Number(job.job_id) === jobId ? { ...job, ...jobPayload } : job));

      const nextState = {
        workspace: current.workspace
          ? {
              ...current.workspace,
              pending_jobs: replaceJob(Array.isArray(current.workspace.pending_jobs) ? current.workspace.pending_jobs : []),
              queued_jobs: replaceJob(Array.isArray(current.workspace.queued_jobs) ? current.workspace.queued_jobs : []),
              completed_jobs: replaceJob(Array.isArray(current.workspace.completed_jobs) ? current.workspace.completed_jobs : []),
            }
          : current.workspace,
      };

      if (current.selectedJob && Number(current.selectedJob.job_id) === jobId) {
        nextState.selectedJob = { ...current.selectedJob, ...jobPayload };
      }

      return nextState;
    });
  }

  async function connectWorkspaceEventSocket(workflowId = stateRef.current.selectedWorkflowId) {
    if (!workflowId) return;
    closeWorkspaceEventSocket();

    const socket = new WebSocket(workspaceApi.getWorkspaceEventsUrl());
    workspaceEventSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));
        if (Number(payload.workflow_id) !== Number(workflowId)) return;

        if (payload.event === "job.running" || payload.type === "job.running") {
          patchWorkspaceJob({
            ...(payload.job || {}),
            status: "running",
          });
          patchState({ notice: payload.message || "Model request sent.", error: "", workspaceError: "" });
          return;
        }

        if (payload.event === "job.queued" || payload.type === "job.queued") {
          patchWorkspaceJob(payload.job || {});
          patchState({ notice: payload.message || "Job queued.", error: "", workspaceError: "" });
          loadWorkspace(workflowId);
          return;
        }

        if (payload.event === "job.file_refs_uploaded" || payload.type === "job.file_refs_uploaded") {
          patchState({ workspaceActionStatus: payload.message || "File refs uploaded.", error: "", workspaceError: "" });
          return;
        }

        if (payload.event === "job.created" || payload.type === "job.created") {
          patchState({ notice: payload.message || "Job created.", workspaceActionStatus: "", error: "", workspaceError: "" });
          return;
        }

        if (payload.event === "job.completed" || payload.type === "job.completed") {
          patchState({ notice: payload.message || "Transcription completed.", error: "", workspaceError: "" });
          const openJobId = stateRef.current.selectedJob?.job_id;
          void (async () => {
            await loadWorkspace(workflowId);
            if (openJobId != null) {
              await openJobDetail(openJobId);
            }
          })();
          return;
        }

        if (payload.event === "job.failed" || payload.type === "job.failed") {
          patchState({ workspaceError: payload.message || "Transcription failed." });
          const openJobId = stateRef.current.selectedJob?.job_id;
          void (async () => {
            await loadWorkspace(workflowId);
            if (openJobId != null) {
              await openJobDetail(openJobId);
            }
          })();
        }
      } catch {
        // Keep the socket alive for malformed payloads.
      }
    };

    socket.onclose = () => {
      if (workspaceEventSocketRef.current === socket) {
        workspaceEventSocketRef.current = null;
      }
      scheduleWorkspaceEventReconnect();
    };

    socket.onerror = () => {
      scheduleWorkspaceEventReconnect();
    };
  }

  async function loadWorkflows({ keepSelection = true } = {}) {
    patchState({ loading: true, error: "" });

    try {
      const response = await workspaceApi.getWorkflows();
      console.log(response.workflows);
      setState((current) => {
        const workflows = response.workflows || [];
        const selectedWorkflowId =
          keepSelection &&
          workflows.some((workflow) => Number(workflow.workflow_id) === Number(current.selectedWorkflowId))
            ? current.selectedWorkflowId
            : null;
        const workspacePickerWorkflowId =
          keepSelection &&
          workflows.some((workflow) => Number(workflow.workflow_id) === Number(current.workspacePickerWorkflowId))
            ? current.workspacePickerWorkflowId
            : null;

        return {
          ...current,
          loading: false,
          error: "",
          workflows,
          selectedWorkflowId,
          workspacePickerWorkflowId,
          workspace: selectedWorkflowId == null ? null : current.workspace,
          workspaceLoading: selectedWorkflowId == null ? false : current.workspaceLoading,
          workspaceError: selectedWorkflowId == null ? "" : current.workspaceError,
          selectedWorkspaceTranscriptionId: selectedWorkflowId == null ? null : current.selectedWorkspaceTranscriptionId,
          selectedWorkspaceTranscription: selectedWorkflowId == null ? null : current.selectedWorkspaceTranscription,
          selectedJob: selectedWorkflowId == null ? null : current.selectedJob,
          jobDetailOpen: selectedWorkflowId == null ? false : current.jobDetailOpen,
          workspaceActionStatus: selectedWorkflowId == null ? "" : current.workspaceActionStatus,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        workflows: [],
        selectedWorkflowId: null,
        workspacePickerWorkflowId: null,
        workspace: null,
        workspaceLoading: false,
        workspaceError: "",
        workspaceActionStatus: "",
        selectedWorkspaceTranscriptionId: null,
        selectedWorkspaceTranscription: null,
        selectedJob: null,
        jobDetailOpen: false,
      }));
    }
  }

  async function loadWorkspace(workflowId = stateRef.current.selectedWorkflowId) {
    const workflow = stateRef.current.workflows.find((item) => Number(item.workflow_id) === Number(workflowId));
    if (!workflow) {
      patchState({
        ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
        workspaceError: "Select a workflow first.",
      });
      return;
    }

    patchState({
      ...resetWorkspaceState({ preserveWorkspaceUi: true }),
      selectedWorkflowId: workflow.workflow_id,
      workspaceLoading: true,
    });

    try {
      const workspace = await workspaceApi.getWorkspace(workflow.workflow_id);
      const initialTranscription =
        Array.isArray(workspace?.transcriptions) && workspace.transcriptions.length ? workspace.transcriptions[0] : null;

      patchState({
        workspace,
        workspaceLoading: false,
        workspaceError: "",
        selectedWorkflowId: workflow.workflow_id,
        selectedWorkspaceTranscriptionId: initialTranscription ? Number(initialTranscription.transcription_id) : null,
        selectedWorkspaceTranscription: null,
        workspaceReviewCompareExpanded: false,
      });

      void connectWorkspaceEventSocket(workflow.workflow_id);
      if (initialTranscription) {
        await loadWorkspaceTranscriptionDetail(initialTranscription.transcription_id);
      }
    } catch (error) {
      patchState({
        workspace: null,
        workspaceLoading: false,
        workspaceError: error instanceof Error ? error.message : String(error),
        selectedWorkflowId: workflow.workflow_id,
        selectedWorkspaceTranscriptionId: null,
        selectedWorkspaceTranscription: null,
        selectedJob: null,
        jobDetailOpen: false,
      });
      closeWorkspaceEventSocket();
    }
  }

  async function openWorkspaceForWorkflow(workflowId) {
    closeWorkspaceEventSocket();
    patchState({
      ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
      selectedWorkflowId: Number(workflowId),
    });
    await loadWorkspace(Number(workflowId));
  }

  async function refreshCurrentView() {
    if (stateRef.current.selectedWorkflowId) {
      await loadWorkspace(stateRef.current.selectedWorkflowId);
      return;
    }
    await loadWorkflows();
  }

  async function loadWorkspaceTranscriptionDetail(transcriptionId) {
    if (!stateRef.current.selectedWorkflowId || transcriptionId == null) return;
    try {
      const detail = await workspaceApi.getWorkspaceTranscription(stateRef.current.selectedWorkflowId, transcriptionId);
      patchState({
        selectedWorkspaceTranscriptionId: Number(transcriptionId),
        selectedWorkspaceTranscription: detail,
        workspaceReviewCompareExpanded: stateRef.current.workspaceReviewCompareExpanded,
      });
    } catch (error) {
      patchState({ workspaceError: error instanceof Error ? error.message : String(error) });
    }
  }

  async function openJobDetail(jobId) {
    try {
      const workflowId = stateRef.current.selectedWorkflowId;
      if (!workflowId) return;
      const job = await workspaceApi.getWorkspaceJob(workflowId, jobId);
      patchState({
        selectedJob: job,
        jobDetailOpen: true,
        workspaceError: "",
        error: "",
      });
    } catch (error) {
      patchState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function updateWorkspaceJobs({ action, jobIds = [], notice }) {
    try {
      const workflowId = stateRef.current.selectedWorkflowId;
      if (!workflowId) {
        patchState({ workspaceError: "Select a workflow first." });
        return;
      }

      if (action === "queue") {
        await workspaceApi.queueWorkspaceJobs(workflowId, jobIds);
      } else {
        await workspaceApi.retryWorkspaceJobs(workflowId, jobIds);
      }

      if (notice) {
        patchState({ notice, error: "", workspaceError: "" });
      } else {
        patchState({ error: "", workspaceError: "" });
      }

      const openJobId = stateRef.current.selectedJob?.job_id;
      patchState({ workspaceJobSelection: { pending: [], queued: [], completed: [] } });
      await loadWorkspace(workflowId);
      if (openJobId != null) {
        await openJobDetail(openJobId);
      }
    } catch (error) {
      patchState({
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function deleteWorkspaceJobs(kind) {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) {
      patchState({ workspaceError: "Select a workflow first." });
      return;
    }

    const pendingJobs = workspaceJobsByKind("pending");
    const queuedJobs = workspaceJobsByKind("queued");
    const completedJobs = workspaceJobsByKind("completed");
    const totalJobs = pendingJobs.length + queuedJobs.length + completedJobs.length;

    if (kind === "all" && !totalJobs) {
      patchState({ notice: "No jobs to delete.", error: "", workspaceError: "" });
      return;
    }

    const label = kind === "pending" ? "pending" : kind === "queued" ? "queued" : kind === "completed" ? "completed" : "all";
    const confirmMessage =
      kind === "all"
        ? "Delete all jobs in this workflow? This will remove the jobs and any assembled transcriptions linked to them."
        : `Delete all ${label} jobs? This will remove the jobs and any assembled transcriptions linked to them.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await workspaceApi.deleteWorkspaceJobs(workflowId, kind);
      patchState({
        notice: kind === "all" ? "Deleted all workflow jobs." : `Deleted ${workspaceJobsByKind(label).length} ${label} job(s).`,
        error: "",
        workspaceError: "",
        workspaceJobSelection: { pending: [], queued: [], completed: [] },
        selectedJob: null,
        jobDetailOpen: false,
        selectedWorkspaceTranscription: null,
        selectedWorkspaceTranscriptionId: null,
      });
      await loadWorkspace(workflowId);
    } catch (error) {
      patchState({
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function createWorkspaceJobs() {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) {
      patchState({ workspaceError: "Select a workflow first." });
      return;
    }

    try {
      patchState({
        workspaceActionStatus: "Generating jobs...",
        workspaceError: "",
        error: "",
        notice: "",
      });
      const response = await workspaceApi.createWorkspaceJobs(workflowId);
      patchState({
        workspaceActionStatus: "",
        ...(response?.message ? { notice: response.message, error: "", workspaceError: "" } : {}),
      });
      await loadWorkspace(workflowId);
    } catch (error) {
      patchState({
        workspaceActionStatus: "",
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function assembleTranscriptions() {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) {
      patchState({ workspaceError: "Select a workflow first." });
      return;
    }

    try {
      await workspaceApi.createWorkspaceTranscriptions(workflowId);
      patchState({ notice: "Transcriptions assembled.", error: "", workspaceError: "" });
      await loadWorkspace(workflowId);
    } catch (error) {
      patchState({
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function scoreWorkspace() {
    const workflowId = stateRef.current.selectedWorkflowId;
    if (!workflowId) {
      patchState({ workspaceError: "Select a workflow first." });
      return;
    }

    try {
      await workspaceApi.scoreWorkspace(workflowId);
      patchState({ notice: "Transcriptions scored.", error: "", workspaceError: "" });
      await loadWorkspace(workflowId);
    } catch (error) {
      patchState({
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function setWorkspaceJobSelection(status, jobId, shouldInclude) {
    const next = {
      pending: [...workspaceJobSelection("pending")],
      queued: [...workspaceJobSelection("queued")],
      completed: [...workspaceJobSelection("completed")],
    };
    const list = next[status] || [];
    const id = Number(jobId);
    const index = list.indexOf(id);
    if (shouldInclude && index === -1) list.push(id);
    if (!shouldInclude && index !== -1) list.splice(index, 1);
    patchState({ workspaceJobSelection: next });
  }

  function setWorkspacePane(workspacePane) {
    if (!["jobs", "assembly", "review"].includes(workspacePane)) return;
    patchState({ workspacePane });
  }

  function toggleReviewCompare() {
    patchState({ workspaceReviewCompareExpanded: !stateRef.current.workspaceReviewCompareExpanded });
  }

  function setWorkspaceReviewQuery(query) {
    patchState({ workspaceReviewQuery: query });
  }

  function setWorkspaceReviewSort(sort) {
    patchState({ workspaceReviewSort: sort });
  }

  function setWorkspacePickerWorkflowId(workflowId) {
    patchState({
      workspacePickerWorkflowId: Number(workflowId) || null,
      workspaceError: "",
    });
  }

  function selectTranscription(transcriptionId) {
    const id = Number(transcriptionId);
    if (!id) return;
    patchState({ selectedWorkspaceTranscriptionId: id });
    void loadWorkspaceTranscriptionDetail(id);
  }

  function toggleWorkspaceJobSelection(status, jobId, shouldInclude) {
    if (!["pending", "queued", "completed"].includes(status)) return;
    setWorkspaceJobSelection(status, jobId, shouldInclude);
  }

  function selectVisibleWorkspaceJobs(status) {
    if (!["pending", "queued", "completed"].includes(status)) return;
    const visibleJobs = workspaceJobsByKind(status);
    const currentSelection = {
      pending: workspaceJobSelection("pending"),
      queued: workspaceJobSelection("queued"),
      completed: workspaceJobSelection("completed"),
    };
    const visibleJobIds = visibleJobs.map((job) => Number(job.job_id));
    const allSelected = visibleJobIds.length > 0 && visibleJobIds.every((jobId) => currentSelection[status].includes(jobId));
    const nextSelection = { ...currentSelection, [status]: allSelected ? [] : visibleJobIds };
    patchState({ workspaceJobSelection: nextSelection });
  }

  function queueSelectedJobs() {
    void updateWorkspaceJobs({
      action: "queue",
      jobIds: workspaceJobSelection("pending"),
      notice: "Pending jobs queued.",
    });
  }

  function unqueueSelectedJobs() {
    void updateWorkspaceJobs({
      action: "retry",
      jobIds: workspaceJobSelection("queued"),
      notice: "Queued jobs moved back to pending.",
    });
  }

  function retrySelectedJobs() {
    void updateWorkspaceJobs({
      action: "retry",
      jobIds: workspaceJobSelection("completed"),
      notice: "Completed jobs marked for retry.",
    });
  }

  function openDashboard() {
    router.push("/dashboard");
  }

  function closeJobDetail() {
    patchState({
      jobDetailOpen: false,
      selectedJob: null,
    });
  }

  function openSelectedWorkflow() {
    if (!stateRef.current.workspacePickerWorkflowId) {
      patchState({ workspaceError: "Select a workflow first." });
      return;
    }
    void openWorkspaceForWorkflow(stateRef.current.workspacePickerWorkflowId);
  }

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("workspace-page", [
      { kind: "error", message: state.error },
      { kind: "error", message: state.workspaceError },
      { kind: "status", message: state.workspaceActionStatus },
      { kind: "success", message: state.notice },
    ]);
  }, [syncNotifications, state.error, state.notice, state.workspaceActionStatus, state.workspaceError]);

  useEffect(() => {
    void loadWorkflows({ keepSelection: false });
    return () => {
      closeWorkspaceEventSocket();
    };
  }, []);

  useLayoutEffect(() => {
    const positions = scrollPositionsRef.current;
    if (!positions.size) return;

    const root = rootRef.current;
    if (!(root instanceof HTMLElement)) return;

    root.querySelectorAll("[data-preserve-scroll-key]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const key = element.dataset.preserveScrollKey;
      if (!key || !positions.has(key)) return;
      element.scrollTop = positions.get(key);
    });

    scrollPositionsRef.current = new Map();
  }, [state]);

  const actions = {
    openDashboard,
    openSelectedWorkflow,
    setWorkspacePickerWorkflowId,
    setWorkspacePane,
    toggleReviewCompare,
    setWorkspaceReviewQuery,
    setWorkspaceReviewSort,
    selectTranscription,
    toggleWorkspaceJobSelection,
    selectVisibleWorkspaceJobs,
    queueSelectedJobs,
    unqueueSelectedJobs,
    retrySelectedJobs,
    createWorkspaceJobs,
    deleteWorkspaceJobs,
    assembleTranscriptions,
    scoreWorkspace,
    closeJobDetail,
    refreshCurrentView,
    openWorkspaceForWorkflow,
    openJobDetail,
    loadWorkspace,
  };

  return {
    state,
    actions,
    rootRef,
  };
}
