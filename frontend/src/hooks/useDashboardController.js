import { renderAppShell } from "../components/AppShell.js";
import { renderDashboardIntro } from "../components/DashboardIntro.js";
import { renderFileManagementPanel } from "../components/FileManagementPanel.js";
import { renderSampleSetAnalyticsPanel, renderSampleSetsPanel } from "../components/SampleSetsPanel.js";
import { renderTopBar } from "../components/TopBar.js";
import { renderWorkspacePanel } from "../components/WorkspacePanel.js";
import { renderWorkflowWorkspacePicker } from "../components/WorkflowWorkspacePicker.js";
import {
  renderGroupDetailModal,
  renderGroupModal,
  renderJobDetailModal,
  renderSampleDetailModal,
  renderUploadModal,
  renderValueModal,
  renderWorkflowModal,
} from "../components/Modals.js";
import {
  createGrouping,
  createGroupingValue,
  createSample,
  createSampleSet,
  createWorkflow,
  deleteGrouping,
  deleteSample,
  deleteWorkflow,
  createWorkflowJobs,
  getGroupings,
  getSample,
  getSamples,
  getSampleSetAnalytics,
  getSampleSets,
  getWorkflows,
  getWorkspaceJob,
  getWorkspaceTranscription,
  getWorkspace,
  deleteSampleSet,
  deleteWorkspaceJobs,
  markWorkspaceOpened,
  queueWorkspaceJobs,
  retryWorkspaceJobs,
  createWorkspaceTranscriptions,
  scoreWorkspace,
} from "../services/dashboardService.js";
import { buildWorkflowPayload, defaultBatchItemSchemaEntries, defaultGroupDraft, defaultValueDraft, defaultWorkflowDraft, filterSamplesForPicker, visibleWorkflowSamples } from "../utils/workflow.js";
import {
  collectGroundTruthFolderFiles,
  collectImageFolderFiles,
} from "../utils/upload.js";
import { escapeHtml } from "../utils/html.js";

export function createDashboardController(root) {
  const state = createInitialState();

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  function sampleQueryString() {
    const params = new URLSearchParams();
    if ((state.sampleQuery || "").trim()) params.set("query", state.sampleQuery.trim());
    return params.toString() ? `?${params.toString()}` : "";
  }

  function visibleFileManagementSampleIds() {
    return filterSamplesForPicker(
      visibleWorkflowSamples(state.samples, state.groupings, state.fileManagementGroupFilter, state.fileManagementGroupFilterValue),
      state.fileManagementQuery,
      state.fileManagementQueryMode,
    ).map((sample) => sample.sample_id);
  }

  function selectedGrouping() {
    return state.groupings.find((group) => group.name === state.selectedGroupName) || null;
  }

  function selectedWorkflow() {
    return state.workflows.find((workflow) => Number(workflow.workflow_id) === Number(state.selectedWorkflowId)) || null;
  }

  function workspaceJobSelection(status) {
    const selection = state.workspaceJobSelection || {};
    return Array.isArray(selection[status]) ? selection[status] : [];
  }

  function workspaceJobsByKind(kind) {
    const workspace = state.workspace || {};
    if (kind === "pending") return Array.isArray(workspace.pending_jobs) ? workspace.pending_jobs : [];
    if (kind === "queued") return Array.isArray(workspace.queued_jobs) ? workspace.queued_jobs : [];
    if (kind === "completed") return Array.isArray(workspace.completed_jobs) ? workspace.completed_jobs : [];
    return [];
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
    next[status] = list;
    state.workspaceJobSelection = next;
    render();
  }

  function clearWorkspaceJobSelection(status) {
    if (!status) {
      state.workspaceJobSelection = { pending: [], queued: [], completed: [] };
    } else {
      state.workspaceJobSelection = {
        pending: workspaceJobSelection("pending"),
        queued: workspaceJobSelection("queued"),
        completed: workspaceJobSelection("completed"),
      };
      state.workspaceJobSelection[status] = [];
    }
    render();
  }

  function workspaceTranscriptions() {
    return Array.isArray(state.workspace?.transcriptions) ? state.workspace.transcriptions : [];
  }

  function selectedWorkspaceTranscriptionDetail() {
    return state.selectedWorkspaceTranscription || null;
  }

  function apiBaseUrl() {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  }

  function workspaceEventsUrl() {
    const url = new URL(apiBaseUrl());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return new URL("/api/v1/events", url).toString();
  }

  function closeWorkspaceEventSocket() {
    if (state.workspaceEventReconnectTimer != null) {
      window.clearTimeout(state.workspaceEventReconnectTimer);
      state.workspaceEventReconnectTimer = null;
    }
    if (state.workspaceEventSocket) {
      state.workspaceEventSocket.onopen = null;
      state.workspaceEventSocket.onmessage = null;
      state.workspaceEventSocket.onerror = null;
      state.workspaceEventSocket.onclose = null;
      state.workspaceEventSocket.close();
      state.workspaceEventSocket = null;
    }
  }

  function scheduleWorkspaceEventReconnect() {
    if (!state.selectedWorkflowId || state.prototypeNav !== "workflow-workspace") return;
    if (state.workspaceEventReconnectTimer != null) return;
    state.workspaceEventReconnectTimer = window.setTimeout(() => {
      state.workspaceEventReconnectTimer = null;
      void connectWorkspaceEventSocket();
    }, 1500);
  }

  function patchWorkspaceJob(jobPayload) {
    if (!state.workspace) return;
    const jobId = Number(jobPayload?.job_id);
    if (!Number.isFinite(jobId)) return;

    const replaceJob = (jobs) => jobs.map((job) => (
      Number(job.job_id) === jobId ? { ...job, ...jobPayload } : job
    ));
    state.workspace = {
      ...state.workspace,
      pending_jobs: replaceJob(Array.isArray(state.workspace.pending_jobs) ? state.workspace.pending_jobs : []),
      queued_jobs: replaceJob(Array.isArray(state.workspace.queued_jobs) ? state.workspace.queued_jobs : []),
      completed_jobs: replaceJob(Array.isArray(state.workspace.completed_jobs) ? state.workspace.completed_jobs : []),
    };
    if (state.selectedJob && Number(state.selectedJob.job_id) === jobId) {
      state.selectedJob = { ...state.selectedJob, ...jobPayload };
    }
    render();
  }

  async function connectWorkspaceEventSocket(workflowId = state.selectedWorkflowId) {
    if (!workflowId || state.prototypeNav !== "workflow-workspace") return;
    closeWorkspaceEventSocket();

    const socket = new WebSocket(workspaceEventsUrl());
    state.workspaceEventSocket = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));
        if (Number(payload.workflow_id) !== Number(workflowId)) return;
        if (payload.event === "job.running" || payload.type === "job.running") {
          patchWorkspaceJob({
            ...(payload.job || {}),
            status: "running",
          });
          setState({ notice: payload.message || "Model request sent.", error: "", workspaceError: "" });
          return;
        }
        if (payload.event === "job.completed" || payload.type === "job.completed") {
          setState({ notice: payload.message || "Transcription completed.", error: "", workspaceError: "" });
          const openJobId = state.selectedJob?.job_id;
          void (async () => {
            await loadWorkspace(workflowId);
            if (openJobId != null) {
              await openJobDetail(openJobId);
            }
          })();
          return;
        }
        if (payload.event === "job.failed" || payload.type === "job.failed") {
          setState({ workspaceError: payload.message || "Transcription failed." });
          const openJobId = state.selectedJob?.job_id;
          void (async () => {
            await loadWorkspace(workflowId);
            if (openJobId != null) {
              await openJobDetail(openJobId);
            }
          })();
        }
      } catch {
        // Ignore malformed events and keep the socket alive.
      }
    };

    socket.onclose = () => {
      if (state.workspaceEventSocket === socket) {
        state.workspaceEventSocket = null;
      }
      scheduleWorkspaceEventReconnect();
    };

    socket.onerror = () => {
      scheduleWorkspaceEventReconnect();
    };
  }

  function resetWorkspaceState({ keepSelectedWorkflowId = true, preserveWorkspaceUi = false } = {}) {
    return {
      selectedWorkflowId: keepSelectedWorkflowId ? state.selectedWorkflowId : null,
      workspace: null,
      workspaceLoading: false,
      workspaceError: "",
      workspacePane: preserveWorkspaceUi ? state.workspacePane : "jobs",
      workspaceJobSelection: { pending: [], queued: [], completed: [] },
      workspaceReviewQuery: preserveWorkspaceUi ? state.workspaceReviewQuery : "",
      workspaceReviewSort: preserveWorkspaceUi ? state.workspaceReviewSort : "score",
      workspaceReviewCompareExpanded: preserveWorkspaceUi ? state.workspaceReviewCompareExpanded : false,
      selectedWorkspaceTranscriptionId: null,
      selectedWorkspaceTranscription: null,
      selectedJob: null,
      jobDetailOpen: false,
      workspaceEventSocket: null,
      workspaceEventReconnectTimer: null,
      view: "dashboard",
    };
  }

  function toggleListValue(list, value, shouldInclude) {
    const index = list.indexOf(value);
    if (shouldInclude && index === -1) list.push(value);
    if (!shouldInclude && index !== -1) list.splice(index, 1);
  }

  function updateFilterField(target, { rerender = false } = {}) {
    const scope = target.dataset.filterScope;
    const field = target.dataset.filterField;
    if (!scope || !field) return false;

    const draft = state[scope];
    if (!draft || typeof draft !== "object") {
      if (scope === "fileManagement") {
        if (field === "fileManagementQuery") {
          state.fileManagementQuery = target.value;
          return true;
        }
        if (field === "fileManagementQueryMode") {
          state.fileManagementQueryMode = target.value === "starts-with" ? "starts-with" : target.value === "exact" ? "exact" : "contains";
          render();
          return true;
        }
        if (field === "fileManagementGroupFilter") {
          state.fileManagementGroupFilter = target.value;
          state.fileManagementGroupFilterValue = "";
          render();
          return true;
        }
        if (field === "fileManagementGroupFilterValue") {
          state.fileManagementGroupFilterValue = target.value;
          render();
          return true;
        }
      }
      return false;
    }

    draft[field] = target.value;
    if (rerender) render();
    return true;
  }

  function workflowSampleRow(sampleId) {
    return Array.from(root.querySelectorAll("[data-workflow-sample]")).find(
      (row) => row.dataset.workflowSample === sampleId,
    ) || null;
  }

  function workflowSamplePicker() {
    return root.querySelector("[data-workflow-sample-picker]");
  }

  function stopWorkflowSelectionAutoScroll() {
    if (state.workflowSelectionScrollFrame != null) {
      window.cancelAnimationFrame(state.workflowSelectionScrollFrame);
      state.workflowSelectionScrollFrame = null;
    }
  }

  function sampleIdAtPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest?.("[data-workflow-sample]")?.dataset.workflowSample || null;
  }

  function selectWorkflowSampleAtPoint(clientX, clientY) {
    if (!state.workflowSampleDrag?.active) return;
    const sampleId = sampleIdAtPoint(clientX, clientY);
    if (!sampleId || state.workflowSampleDrag.lastSampleId === sampleId) return;
    state.workflowSampleDrag.lastSampleId = sampleId;
    setWorkflowSampleSelection(sampleId, state.workflowSampleDrag.shouldInclude, { rerender: false });
  }

  function tickWorkflowSelectionAutoScroll() {
    state.workflowSelectionScrollFrame = null;
    if (!state.workflowSampleDrag?.active || state.workflowDraft.input_mode === "single") return;

    const picker = workflowSamplePicker();
    if (!(picker instanceof HTMLElement)) return;

    const { clientX, clientY } = state.workflowSampleDrag;
    const rect = picker.getBoundingClientRect();
    const edgeSize = 48;
    const maxScrollTop = picker.scrollHeight - picker.clientHeight;
    let delta = 0;

    if (clientY >= rect.bottom - edgeSize) {
      const distance = Math.min(edgeSize, Math.max(0, clientY - (rect.bottom - edgeSize)));
      const intensity = distance / edgeSize;
      delta = Math.max(8, Math.round(26 * intensity));
    } else if (clientY <= rect.top + edgeSize) {
      const distance = Math.min(edgeSize, Math.max(0, (rect.top + edgeSize) - clientY));
      const intensity = distance / edgeSize;
      delta = -Math.max(8, Math.round(26 * intensity));
    }

    if (!delta) return;

    const previousScrollTop = picker.scrollTop;
    picker.scrollTop = Math.max(0, Math.min(maxScrollTop, previousScrollTop + delta));
    selectWorkflowSampleAtPoint(clientX, clientY);

    if (picker.scrollTop !== previousScrollTop) {
      state.workflowSelectionScrollFrame = window.requestAnimationFrame(tickWorkflowSelectionAutoScroll);
    }
  }

  function startWorkflowSelectionAutoScroll() {
    if (state.workflowSelectionScrollFrame != null) return;
    state.workflowSelectionScrollFrame = window.requestAnimationFrame(tickWorkflowSelectionAutoScroll);
  }

  function updateWorkflowSampleRow(sampleId) {
    const row = workflowSampleRow(sampleId);
    if (!row) return;
    const selected = state.workflowDraft.sample_ids.includes(sampleId);
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  function syncWorkflowSampleRows() {
    root.querySelectorAll("[data-workflow-sample]").forEach((row) => {
      const sampleId = row.dataset.workflowSample;
      const selected = state.workflowDraft.sample_ids.includes(sampleId);
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function setWorkflowSampleSelection(sampleId, shouldInclude, { rerender = true } = {}) {
    const mode = state.workflowDraft.input_mode === "single" ? "single" : "batch";
    if (mode === "single") {
      state.workflowDraft.sample_ids = shouldInclude ? [sampleId] : [];
      if (rerender) {
        render();
      } else {
        syncWorkflowSampleRows();
      }
      return;
    }

    const current = state.workflowDraft.sample_ids;
    const hasSample = current.includes(sampleId);
    if (shouldInclude && !hasSample) current.push(sampleId);
    if (!shouldInclude && hasSample) {
      state.workflowDraft.sample_ids = current.filter((item) => item !== sampleId);
    }

    if (rerender) {
      render();
    } else {
      updateWorkflowSampleRow(sampleId);
    }
  }

  function selectVisibleWorkflowSamples() {
    const visibleSamples = filterSamplesForPicker(
      visibleWorkflowSamples(
        state.samples,
        state.groupings,
        state.workflowDraft.selection_group_name,
        state.workflowDraft.selection_group_value,
      ),
      state.workflowDraft.selection_query,
      state.workflowDraft.selection_query_mode,
    ).map((sample) => sample.sample_id);

    if (state.workflowDraft.input_mode === "single") {
      state.workflowDraft.sample_ids = visibleSamples.length ? [visibleSamples[0]] : [];
    } else {
      state.workflowDraft.sample_ids = Array.from(new Set(visibleSamples));
    }
    render();
  }

  function selectVisibleGroupSamples() {
    const visibleSamples = filterSamplesForPicker(
      state.samples,
      state.groupDraft.sample_query,
      state.groupDraft.sample_query_mode,
    ).map((sample) => sample.sample_id);

    state.groupDraft.sample_ids = Array.from(new Set([
      ...state.groupDraft.sample_ids,
      ...visibleSamples,
    ]));
    render();
  }

  function selectVisibleValueSamples() {
    const group = selectedGrouping();
    const scopedSamples = group
      ? state.samples.filter((sample) => Object.hasOwn(group.assignments || {}, sample.sample_id))
      : [];
    const visibleSamples = filterSamplesForPicker(
      scopedSamples,
      state.valueDraft.sample_query,
      state.valueDraft.sample_query_mode,
    ).map((sample) => sample.sample_id);

    state.valueDraft.sample_ids = Array.from(new Set([
      ...state.valueDraft.sample_ids,
      ...visibleSamples,
    ]));
    render();
  }

  function addSchemaField() {
    state.workflowDraft.item_schema_entries.push({ field: "", description: "" });
    render();
  }

  function seedBatchSchemaIfEmpty() {
    const entries = state.workflowDraft.item_schema_entries || [];
    const hasAnyContent = entries.some((entry) => String(entry?.field || "").trim() || String(entry?.description || "").trim());
    if (!hasAnyContent) {
      state.workflowDraft.item_schema_entries = defaultBatchItemSchemaEntries();
    }
  }

  function removeSchemaField(index) {
    state.workflowDraft.item_schema_entries.splice(index, 1);
    if (!state.workflowDraft.item_schema_entries.length) {
      state.workflowDraft.item_schema_entries.push({ field: "", description: "" });
    }
    render();
  }

  function clearWorkflowSamples() {
    state.workflowDraft.sample_ids = [];
    render();
  }

  function preserveWorkspaceScrollPositions() {
    const positions = new Map();
    root.querySelectorAll("[data-preserve-scroll-key]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const key = element.dataset.preserveScrollKey;
      if (!key) return;
      positions.set(key, element.scrollTop);
    });
    return positions;
  }

  function restoreWorkspaceScrollPositions(positions) {
    if (!positions.size) return;
    root.querySelectorAll("[data-preserve-scroll-key]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const key = element.dataset.preserveScrollKey;
      if (!key || !positions.has(key)) return;
      element.scrollTop = positions.get(key);
    });
  }

  function closeModals() {
    stopWorkflowSelectionAutoScroll();
    setState({
      uploadOpen: false,
      groupOpen: false,
      groupDetailOpen: false,
      valueOpen: false,
      sampleDetailOpen: false,
      workflowWizardOpen: false,
      jobDetailOpen: false,
      selectedJob: null,
      workflowSampleDrag: null,
      workflowSampleClickSuppressed: false,
    });
  }

  async function loadDashboard() {
    state.loading = true;
    state.error = "";
    render();
    const [dashboardResult, samplesResult, groupingsResult, sampleSetsResult] = await Promise.allSettled([
      getWorkflows(),
      getSamples(sampleQueryString()),
      getGroupings(),
      getSampleSets(),
    ]);

    const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : { workflows: [] };
    const samples = samplesResult.status === "fulfilled" ? samplesResult.value : { samples: [] };
    const groupings = groupingsResult.status === "fulfilled" ? groupingsResult.value : { groupings: [] };
    const sampleSets = sampleSetsResult.status === "fulfilled" ? sampleSetsResult.value : { sample_sets: [] };

    setState({
      workflows: dashboard.workflows || [],
      samples: samples.samples || [],
      groupings: groupings.groupings || [],
      sampleSets: sampleSets.sample_sets || [],
      selectedSampleSetId: null,
      sampleSetAnalytics: null,
      sampleSetAnalyticsError: "",
      sampleSetAnalyticsLoading: false,
      loading: false,
      error: "",
    });

  }

  async function loadSampleSetAnalytics(sampleSetId = state.selectedSampleSetId) {
    if (sampleSetId == null) {
      setState({
        selectedSampleSetId: null,
        sampleSetAnalytics: null,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: "",
      });
      return;
    }

    setState({
      selectedSampleSetId: Number(sampleSetId),
      sampleSetAnalyticsLoading: true,
      sampleSetAnalyticsError: "",
    });

    try {
      const analytics = await getSampleSetAnalytics(sampleSetId);
      setState({
        selectedSampleSetId: Number(sampleSetId),
        sampleSetAnalytics: analytics,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: "",
      });
    } catch (error) {
      setState({
        selectedSampleSetId: Number(sampleSetId),
        sampleSetAnalytics: null,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function loadWorkspace(workflowId = state.selectedWorkflowId) {
    const workflow = state.workflows.find((item) => Number(item.workflow_id) === Number(workflowId));
    if (!workflow) {
      setState({
        ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
        workspaceError: "Select a workflow first.",
        prototypeNav: "workflow-workspace",
      });
      return;
    }

    setState({
      ...resetWorkspaceState({ preserveWorkspaceUi: true }),
      selectedWorkflowId: workflow.workflow_id,
      workspaceLoading: true,
      view: "workspace",
      prototypeNav: "workflow-workspace",
    });

    try {
      await markWorkspaceOpened(workflow.workflow_id, workflow.workflow_stage);
      const workspace = await getWorkspace(workflow.workflow_id);
      const initialTranscription = Array.isArray(workspace?.transcriptions) && workspace.transcriptions.length
        ? workspace.transcriptions[0]
        : null;
      setState({
        workspace,
        workspaceLoading: false,
        workspaceError: "",
        view: "workspace",
        selectedWorkflowId: workflow.workflow_id,
        selectedWorkspaceTranscriptionId: initialTranscription ? Number(initialTranscription.transcription_id) : null,
        selectedWorkspaceTranscription: null,
        workspaceReviewCompareExpanded: false,
        prototypeNav: "workflow-workspace",
      });
      void connectWorkspaceEventSocket(workflow.workflow_id);
      if (initialTranscription) {
        void loadWorkspaceTranscriptionDetail(initialTranscription.transcription_id);
      }
    } catch (error) {
      setState({
        workspaceLoading: false,
        workspaceError: error instanceof Error ? error.message : String(error),
        view: "workspace",
        prototypeNav: "workflow-workspace",
      });
      closeWorkspaceEventSocket();
    }
  }

  async function openWorkspaceForWorkflow(workflowId) {
    closeWorkspaceEventSocket();
    setState({
      ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
      selectedWorkflowId: Number(workflowId),
      view: "workspace",
      prototypeNav: "workflow-workspace",
    });
    await loadWorkspace(Number(workflowId));
  }

  async function refreshCurrentView() {
    if (state.prototypeNav === "workflow-workspace" && state.selectedWorkflowId) {
      await loadWorkspace(state.selectedWorkflowId);
      return;
    }
    await loadDashboard();
  }

  function clearUploadInputs() {
    const sampleId = document.getElementById("upload-sample-id");
    const fileInput = document.getElementById("upload-file");
    const groundTruth = document.getElementById("upload-ground-truth");
    const imageFolderInput = document.getElementById("upload-image-folder");
    const groundTruthFolderInput = document.getElementById("upload-ground-truth-folder");
    if (sampleId instanceof HTMLInputElement) sampleId.value = "";
    if (fileInput instanceof HTMLInputElement) fileInput.value = "";
    if (groundTruth instanceof HTMLTextAreaElement) groundTruth.value = "";
    if (imageFolderInput instanceof HTMLInputElement) imageFolderInput.value = "";
    if (groundTruthFolderInput instanceof HTMLInputElement) groundTruthFolderInput.value = "";
  }

  async function uploadFolderSamples(form) {
    const imageFolderInput = form.querySelector("#upload-image-folder");
    const groundTruthFolderInput = form.querySelector("#upload-ground-truth-folder");
    if (!(imageFolderInput instanceof HTMLInputElement) || !imageFolderInput.files?.length) {
      throw new Error("Select a folder of image files first.");
    }

    const imageFiles = collectImageFolderFiles(Array.from(imageFolderInput.files));
    let textFiles = new Map();

    if (groundTruthFolderInput instanceof HTMLInputElement && groundTruthFolderInput.files?.length) {
      textFiles = await collectGroundTruthFolderFiles(Array.from(groundTruthFolderInput.files));
    }

    if (!imageFiles.length) {
      throw new Error("The selected folder does not contain any image files.");
    }

    let uploadedCount = 0;
    for (const { file, sampleId } of imageFiles) {
      const groundTruthText = textFiles.get(sampleId) || null;
      const formData = new FormData();
      formData.set("sample_id", sampleId);
      formData.set("file", file);
      if (groundTruthText) {
        formData.set("ground_truth_text", groundTruthText);
      }
      await createSample(formData);
      uploadedCount += 1;
      setState({ notice: `Uploaded ${uploadedCount} of ${imageFiles.length} files...`, error: "" });
    }
  }

  async function uploadSingleSample(form) {
    const formData = new FormData(form);
    await createSample(formData);
  }

  async function openSample(sampleId) {
    try {
      const sample = await getSample(sampleId);
      setState({ selectedSample: sample, sampleDetailOpen: true, error: "" });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function loadWorkspaceTranscriptionDetail(transcriptionId) {
    if (!state.selectedWorkflowId || transcriptionId == null) return;
    try {
      const detail = await getWorkspaceTranscription(state.selectedWorkflowId, transcriptionId);
      setState({
        selectedWorkspaceTranscriptionId: Number(transcriptionId),
        selectedWorkspaceTranscription: detail,
        workspaceReviewCompareExpanded: state.workspaceReviewCompareExpanded,
      });
    } catch (error) {
      setState({ workspaceError: error instanceof Error ? error.message : String(error) });
    }
  }

  async function openJobDetail(jobId) {
    try {
      const job = await getWorkspaceJob(state.selectedWorkflowId, jobId);
      setState({
        selectedJob: job,
        jobDetailOpen: true,
        workspaceError: "",
        error: "",
      });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function updateWorkspaceJobs({ action, jobIds = [], notice }) {
    try {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      if (action === "queue") {
        await queueWorkspaceJobs(workflowId, jobIds);
      } else {
        await retryWorkspaceJobs(workflowId, jobIds);
      }
      if (notice) {
        setState({ notice, error: "", workspaceError: "" });
      } else {
        setState({ error: "", workspaceError: "" });
      }
      state.workspaceJobSelection = { pending: [], queued: [], completed: [] };
      await loadWorkspace(workflowId);
      if (state.selectedJob) {
        await openJobDetail(state.selectedJob.job_id);
      }
    } catch (error) {
      setState({
        workspaceError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function submitUpload(form) {
    try {
      const uploadMode = form.dataset.uploadMode || state.uploadMode;
      if (uploadMode === "folder") {
        await uploadFolderSamples(form);
      } else {
        await uploadSingleSample(form);
      }
      setState({
        uploadOpen: false,
        notice: uploadMode === "folder" ? "Samples uploaded." : "Sample uploaded.",
        error: "",
      });
      clearUploadInputs();
      closeModals();
      await loadDashboard();
    } catch (error) {
      closeModals();
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitGroup() {
    const name = state.groupDraft.name.trim();
    if (!name) {
      setState({ error: "Group name is required." });
      return;
    }

    try {
      await createGrouping({ name, sample_ids: state.groupDraft.sample_ids });
      setState({
        groupOpen: false,
        selectedGroupName: name,
        notice: "Grouping saved.",
        error: "",
      });
      await loadDashboard();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitValue() {
    const group = selectedGrouping();
    const value = state.valueDraft.value.trim();
    if (!group) {
      setState({ error: "Select a grouping first." });
      return;
    }
    if (!value) {
      setState({ error: "Value name is required." });
      return;
    }

    try {
      await createGroupingValue(group.name, { value, sample_ids: state.valueDraft.sample_ids });
      setState({
        valueOpen: false,
        valueDraft: defaultValueDraft(),
        notice: "Grouping value saved.",
        error: "",
      });
      await loadDashboard();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  function openValueEditor(valueName) {
    const group = selectedGrouping();
    if (!group) {
      setState({ error: "Select a grouping first." });
      return;
    }

    const entry = Object.entries(group.assignments || {})
      .filter(([, value]) => String(value ?? "").trim() === String(valueName ?? "").trim())
      .map(([sampleId]) => sampleId);

    setState({
      valueOpen: true,
      valueDraft: {
        ...defaultValueDraft(),
        value: valueName,
        editing_value: valueName,
        sample_ids: entry,
      },
    });
  }

  async function submitWorkflow() {
    try {
      stopWorkflowSelectionAutoScroll();
      if (!state.workflowDraft.sample_set_id) {
        setState({ error: "Sample set is required." });
        return;
      }
      await createWorkflow(buildWorkflowPayload(state.workflowDraft, state.sampleSets));
      setState({
        workflowWizardOpen: false,
        workflowDraft: defaultWorkflowDraft(),
        workflowSampleDrag: null,
        wizardStep: 0,
        notice: "Workflow created.",
        error: "",
      });
      await loadDashboard();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitFileManagement() {
    const visibleSampleIds = visibleFileManagementSampleIds();
    const selectedSampleIds = state.fileManagementSelection.length ? state.fileManagementSelection : visibleSampleIds;

    try {
      if (state.fileManagementMode === "create-sample-set") {
        const sampleSetName = state.fileManagementDraft.sample_set_name.trim();
        const sampleSetType = state.fileManagementDraft.sample_set_type.trim();
        if (!sampleSetName) {
          setState({ error: "Sample set name is required." });
          return;
        }
        if (!sampleSetType) {
          setState({ error: "Sample set type is required." });
          return;
        }

        await createSampleSet({
          name: sampleSetName,
          type: sampleSetType,
          description: state.fileManagementDraft.sample_set_description.trim() || null,
          sample_ids: visibleSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...state.fileManagementDraft,
            sample_set_name: "",
            sample_set_type: "",
            sample_set_description: "",
          },
          notice: `Sample set ${sampleSetName} saved.`,
          error: "",
        });
      } else if (state.fileManagementMode === "assign-grouping-value") {
        const groupingName = (state.fileManagementDraft.grouping_value_group_name || state.groupings[0]?.name || "").trim();
        const valueName = state.fileManagementDraft.grouping_value_name.trim();
        if (!groupingName) {
          setState({ error: "Grouping is required." });
          return;
        }
        if (!valueName) {
          setState({ error: "Value name is required." });
          return;
        }

        await createGroupingValue(groupingName, {
          value: valueName,
          sample_ids: visibleSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...state.fileManagementDraft,
            grouping_value_name: "",
          },
          notice: `Value ${valueName} saved for ${groupingName}.`,
          error: "",
        });
      } else if (state.fileManagementMode === "delete-samples") {
        if (!selectedSampleIds.length) {
          setState({ error: "Select at least one sample to delete." });
          return;
        }
        if (!window.confirm(`Delete ${selectedSampleIds.length} sample(s)? This cannot be undone.`)) return;

        for (const sampleId of selectedSampleIds) {
          await deleteSample(sampleId);
        }
        setState({
          fileManagementSelection: [],
          notice: `${selectedSampleIds.length} sample(s) deleted.`,
          error: "",
        });
        await loadDashboard();
        return;
      } else {
        const groupingName = state.fileManagementDraft.grouping_name.trim();
        if (!groupingName) {
          setState({ error: "Grouping name is required." });
          return;
        }

        await createGrouping({
          name: groupingName,
          sample_ids: visibleSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...state.fileManagementDraft,
            grouping_name: "",
          },
          notice: `Grouping ${groupingName} saved.`,
          error: "",
        });
      }

      await loadDashboard();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  function render() {
    if (!state.selectedGroupName && state.groupings.length) {
      state.selectedGroupName = state.groupings[0].name;
    }

    const preservedWorkspaceScrollPositions = preserveWorkspaceScrollPositions();
    const workflow = selectedWorkflow();
    const isWorkspaceNav = state.prototypeNav === "workflow-workspace";
    const isWorkspaceView = isWorkspaceNav && Boolean(state.selectedWorkflowId);
    const selectedWorkflowName = workflow?.workflow_name || state.workspace?.workflow?.workflow_name || "";
    const topbarLoading = state.loading || state.workspaceLoading;
    const isDashboardIntro = state.prototypeNav === "dashboard" && !state.sampleSets.length;
    const isFileManagement = state.prototypeNav === "file-management";
    const showSampleSetAnalytics = state.prototypeNav === "dashboard" && Boolean(state.selectedSampleSetId);
    const selectedSampleSet = state.sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === Number(state.selectedSampleSetId)) || null;

    root.innerHTML = renderAppShell({
      topbar: renderTopBar({
        loading: topbarLoading,
        workflowCount: state.workflows.length,
        sampleCount: state.samples.length,
        sampleSetCount: state.sampleSets.length,
        view: isWorkspaceView ? "workspace" : "dashboard",
        workflowName: selectedWorkflowName,
        prototypeNav: state.prototypeNav,
      }),
      error: escapeHtml(state.error),
      status: escapeHtml(state.workspaceActionStatus),
      notice: escapeHtml(state.notice),
      main: isDashboardIntro
        ? `
          <main class="dashboard-grid dashboard-grid-intro">
            ${renderDashboardIntro()}
          </main>
        `
        : isFileManagement
          ? `
            <main class="file-management-page">
              ${renderFileManagementPanel({
              samples: state.samples,
              sampleSets: state.sampleSets,
              groupings: state.groupings,
              fileManagementQuery: state.fileManagementQuery,
              fileManagementQueryMode: state.fileManagementQueryMode,
              fileManagementGroupFilter: state.fileManagementGroupFilter,
              fileManagementGroupFilterValue: state.fileManagementGroupFilterValue,
              appliedFileManagementQuery: state.appliedFileManagementQuery,
              appliedFileManagementQueryMode: state.appliedFileManagementQueryMode,
              appliedFileManagementGroupFilter: state.appliedFileManagementGroupFilter,
              appliedFileManagementGroupFilterValue: state.appliedFileManagementGroupFilterValue,
              fileManagementSelection: state.fileManagementSelection,
              uploadMode: state.uploadMode,
              fileManagementMode: state.fileManagementMode,
              fileManagementDraft: state.fileManagementDraft,
              selectedSampleSetId: state.selectedSampleSetId,
            })}
          </main>
          `
          : isWorkspaceNav && !state.selectedWorkflowId
        ? `
          <main class="workspace-page">
            ${renderWorkflowWorkspacePicker({
              workflows: state.workflows,
              selectedWorkflowId: state.workspacePickerWorkflowId,
              loading: state.loading || state.workspaceLoading,
              error: state.workspaceError,
            })}
          </main>
        `
        : isWorkspaceView
        ? `
          <main class="workspace-page">
            ${renderWorkspacePanel({
              workspace: state.workspace,
              loading: state.workspaceLoading,
              error: state.workspaceError,
              activePane: state.workspacePane,
              jobSelection: state.workspaceJobSelection,
              reviewQuery: state.workspaceReviewQuery,
              reviewSort: state.workspaceReviewSort,
              selectedTranscriptionId: state.selectedWorkspaceTranscriptionId,
              reviewCompareExpanded: state.workspaceReviewCompareExpanded,
              selectedTranscription: state.selectedWorkspaceTranscription,
            })}
          </main>
          `
        : `
          <main class="dashboard-grid">
            ${renderSampleSetsPanel({
              sampleSets: state.sampleSets,
              selectedSampleSetId: state.selectedSampleSetId,
            })}
            <div class="main-area">
              ${showSampleSetAnalytics ? renderSampleSetAnalyticsPanel({
                workflow: selectedSampleSet,
                sampleSet: selectedSampleSet,
                sampleSetAnalytics: state.sampleSetAnalytics,
                analyticsLoading: state.sampleSetAnalyticsLoading,
                analyticsError: state.sampleSetAnalyticsError,
              }) : `<section class="panel"><div class="empty-state">Please select a sample set to view analytics.</div></section>`}
            </div>
          </main>
        `,
      modals: [
        renderUploadModal({ open: state.uploadOpen, uploadMode: state.uploadMode }),
        renderGroupModal({ open: state.groupOpen, samples: state.samples, groupDraft: state.groupDraft }),
        renderGroupDetailModal({
          open: state.groupDetailOpen,
          groupings: state.groupings,
          selectedGroupName: state.selectedGroupName,
        }),
        renderValueModal({
          open: state.valueOpen,
          samples: state.samples,
          groupings: state.groupings,
          selectedGroupName: state.selectedGroupName,
          valueDraft: state.valueDraft,
        }),
        renderSampleDetailModal({
          open: state.sampleDetailOpen,
          sample: state.selectedSample,
          groupings: state.groupings,
        }),
        renderJobDetailModal({
          open: state.jobDetailOpen,
          job: state.selectedJob,
        }),
        renderWorkflowModal({
          open: state.workflowWizardOpen,
          wizardStep: state.wizardStep,
          workflowDraft: state.workflowDraft,
          sampleSets: state.sampleSets,
          groupings: state.groupings,
        }),
      ].join(""),
    });
    restoreWorkspaceScrollPositions(preservedWorkspaceScrollPositions);
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);

  /**
  function onWindowFocus() {
    if (state.uploadOpen) return;
    void refreshCurrentView();
  }
  **/
  function onPageShow(event) {
    if (event.persisted) {
      void refreshCurrentView();
    }
  }
  

  /** window.addEventListener("focus", onWindowFocus); **/
  window.addEventListener("pageshow", onPageShow);

  render();
  void loadDashboard();

  return function disposeDashboardController() {
    document.removeEventListener("click", onClick);
    document.removeEventListener("input", onInput);
    document.removeEventListener("change", onChange);
    document.removeEventListener("submit", onSubmit);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("focus", onWindowFocus);
    window.removeEventListener("pageshow", onPageShow);
    closeWorkspaceEventSocket();
    window.clearTimeout(state.sampleSearchTimer);
    stopWorkflowSelectionAutoScroll();
  };

  function onClick(event) {
    const sampleTarget = event.target.closest("[data-workflow-sample]");
    if (sampleTarget) {
      const sampleId = sampleTarget.dataset.workflowSample;
      if (state.workflowSampleClickSuppressed) {
        return;
      }
      const shouldInclude = !state.workflowDraft.sample_ids.includes(sampleId);
      setWorkflowSampleSelection(sampleId, shouldInclude, { rerender: true });
      return;
    }

    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === "refresh") void refreshCurrentView();
    if (action === "open-workflow") {
      stopWorkflowSelectionAutoScroll();
      setState({
        workflowWizardOpen: true,
        wizardStep: 0,
        workflowDraft: defaultWorkflowDraft(),
        workflowSampleDrag: null,
        workflowSampleClickSuppressed: false,
      });
    }
    if (action === "open-upload") setState({ uploadOpen: true });
    if (action === "set-upload-mode") {
      setState({ uploadMode: actionTarget.dataset.uploadMode || "single" });
    }
    if (action === "open-group") {
      setState({ groupOpen: true, groupDraft: defaultGroupDraft() });
    }
    if (action === "close-modals") closeModals();
    if (action === "close-workspace") {
      closeWorkspaceEventSocket();
      setState({
        prototypeNav: "dashboard",
        ...resetWorkspaceState(),
      });
    }
    if (action === "select-workflow") {
      const workflowId = Number(actionTarget.dataset.workflowId);
      const workflow = state.workflows.find((item) => Number(item.workflow_id) === workflowId);
      setState({ selectedWorkflowId: workflowId });
      if (workflow?.sample_set_id != null) {
        void loadSampleSetAnalytics(workflow.sample_set_id);
      } else {
        setState({
          selectedSampleSetId: null,
          sampleSetAnalytics: null,
          sampleSetAnalyticsError: "",
          sampleSetAnalyticsLoading: false,
        });
      }
    }
    if (action === "open-workspace") {
      const workflowId = actionTarget.dataset.workflowId;
      if (!workflowId) return;
      void openWorkspaceForWorkflow(workflowId);
    }
    if (action === "open-selected-workflow") {
      if (!state.workspacePickerWorkflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      void openWorkspaceForWorkflow(state.workspacePickerWorkflowId);
    }
    if (action === "delete-workflow") {
      const workflowId = Number(actionTarget.dataset.workflowId);
      const workflow = state.workflows.find((item) => Number(item.workflow_id) === workflowId);
      const workflowLabel = workflow?.workflow_name || `workflow ${workflowId}`;
      if (!window.confirm(`Delete ${workflowLabel}? This cannot be undone.`)) return;

      void (async () => {
        try {
          await deleteWorkflow(workflowId);
          const deletingSelectedWorkflow = Number(state.selectedWorkflowId) === workflowId;
          const deletingCurrentWorkspace = state.view === "workspace" && deletingSelectedWorkflow;
          setState({
            notice: `Deleted ${workflowLabel}.`,
            error: "",
            workspaceError: "",
            selectedWorkflowId: deletingSelectedWorkflow ? null : state.selectedWorkflowId,
            view: deletingCurrentWorkspace ? "dashboard" : state.view,
            workspace: deletingCurrentWorkspace ? null : state.workspace,
            workspaceLoading: deletingCurrentWorkspace ? false : state.workspaceLoading,
            selectedJob: null,
            jobDetailOpen: false,
            selectedWorkspaceTranscription: null,
            selectedWorkspaceTranscriptionId: null,
            workspaceReviewCompareExpanded: false,
            workspacePane: deletingCurrentWorkspace ? "jobs" : state.workspacePane,
            workspaceJobSelection: deletingCurrentWorkspace ? { pending: [], queued: [], completed: [] } : state.workspaceJobSelection,
            prototypeNav: deletingCurrentWorkspace ? "dashboard" : state.prototypeNav,
          });
          await refreshCurrentView();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "select-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      if (!sampleSetId) return;
      setState({
        prototypeNav: "dashboard",
        selectedSampleSetId: sampleSetId,
        sampleSetAnalyticsLoading: true,
        sampleSetAnalyticsError: "",
      });
      void loadSampleSetAnalytics(sampleSetId);
    }
    if (action === "delete-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      const sampleSet = state.sampleSets.find((item) => Number(item.sample_set_id) === sampleSetId);
      const sampleSetLabel = sampleSet?.sample_set_name || `sample set ${sampleSetId}`;
      if (!sampleSetId) return;
      if (!window.confirm(`Delete ${sampleSetLabel}? This cannot be undone.`)) return;

      void (async () => {
        try {
          await deleteSampleSet(sampleSetId);
          setState({
            notice: `Deleted ${sampleSetLabel}.`,
            error: "",
            sampleSetAnalytics: Number(state.selectedSampleSetId) === sampleSetId ? null : state.sampleSetAnalytics,
            sampleSetAnalyticsError: "",
            selectedSampleSetId: Number(state.selectedSampleSetId) === sampleSetId ? null : state.selectedSampleSetId,
          });
          await loadDashboard();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "delete-sample") {
      const sampleId = actionTarget.dataset.sampleId;
      if (!sampleId) return;
      if (!window.confirm(`Delete sample ${sampleId}? This cannot be undone.`)) return;

      void (async () => {
        try {
          await deleteSample(sampleId);
          setState({
            notice: `Deleted sample ${sampleId}.`,
            error: "",
            sampleDetailOpen: false,
            selectedSample: null,
          });
          await refreshCurrentView();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "delete-group") {
      const groupName = actionTarget.dataset.groupName;
      if (!groupName) return;
      if (!window.confirm(`Delete grouping ${groupName}? This cannot be undone.`)) return;

      void (async () => {
        try {
          await deleteGrouping(groupName);
          setState({
            notice: `Deleted grouping ${groupName}.`,
            error: "",
            groupDetailOpen: false,
            valueOpen: false,
            selectedGroupName: null,
            valueDraft: defaultValueDraft(),
          });
          await refreshCurrentView();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "create-workspace-jobs") {
      const workflow = selectedWorkflow();
      if (!workflow) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      void (async () => {
        try {
          setState({
            workspaceActionStatus: "Generating jobs...",
            workspaceError: "",
            error: "",
            notice: "",
          });
          await createWorkflowJobs(workflow.workflow_id);
          await loadWorkspace(workflow.workflow_id);
          setState({ workspaceActionStatus: "", notice: "Workflow jobs generated.", error: "" });
        } catch (error) {
          setState({
            workspaceActionStatus: "",
            workspaceError: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    }
    if (action === "workspace-pane") {
      setState({ workspacePane: actionTarget.dataset.workspacePane || "jobs" });
    }
    if (action === "toggle-review-compare") {
      setState({ workspaceReviewCompareExpanded: !state.workspaceReviewCompareExpanded });
    }
    if (action === "select-transcription") {
      const transcriptionId = Number(actionTarget.dataset.transcriptionId);
      if (!transcriptionId) return;
      setState({ selectedWorkspaceTranscriptionId: transcriptionId });
      void loadWorkspaceTranscriptionDetail(transcriptionId);
    }
    if (action === "toggle-workspace-job") {
      const status = actionTarget.dataset.jobStatus;
      const jobId = Number(actionTarget.dataset.jobId);
      if (!status || !jobId) return;
      const shouldInclude = actionTarget instanceof HTMLInputElement ? actionTarget.checked : !workspaceJobSelection(status).includes(jobId);
      setWorkspaceJobSelection(status, jobId, shouldInclude);
    }
    if (action === "select-visible-workspace-jobs") {
      const status = actionTarget.dataset.jobStatus;
      if (!status) return;
      const visibleJobs = workspaceJobsByKind(status);
      const currentSelection = {
        pending: workspaceJobSelection("pending"),
        queued: workspaceJobSelection("queued"),
        completed: workspaceJobSelection("completed"),
      };
      const visibleJobIds = visibleJobs.map((job) => Number(job.job_id));
      const allSelected = visibleJobIds.length > 0 && visibleJobIds.every((jobId) => currentSelection[status].includes(jobId));
      state.workspaceJobSelection = currentSelection;
      state.workspaceJobSelection[status] = allSelected ? [] : visibleJobIds;
      render();
    }
    if (action === "delete-pending-jobs" || action === "delete-queued-jobs" || action === "delete-completed-jobs") {
      const kind = action === "delete-pending-jobs" ? "pending" : action === "delete-queued-jobs" ? "queued" : "completed";
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      const count = workspaceJobsByKind(kind).length;
      const label = kind === "pending" ? "pending" : kind === "queued" ? "queued" : "completed";
      if (!window.confirm(`Delete all ${label} jobs? This will remove the jobs and any assembled transcriptions linked to them.`)) {
        return;
      }
      void (async () => {
        try {
          await deleteWorkspaceJobs(workflowId, kind);
          state.workspaceJobSelection = { pending: [], queued: [], completed: [] };
          setState({
            notice: `Deleted ${count} ${label} job(s).`,
            error: "",
            workspaceError: "",
            selectedJob: null,
            jobDetailOpen: false,
            selectedWorkspaceTranscription: null,
            selectedWorkspaceTranscriptionId: null,
          });
          await loadWorkspace(workflowId);
        } catch (error) {
          setState({ workspaceError: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "delete-workspace-jobs") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      const totalJobs = workspaceJobsByKind("pending").length + workspaceJobsByKind("queued").length + workspaceJobsByKind("completed").length;
      if (!totalJobs) {
        setState({ notice: "No jobs to delete.", error: "", workspaceError: "" });
        return;
      }
      if (!window.confirm("Delete all jobs in this workflow? This will remove the jobs and any assembled transcriptions linked to them.")) {
        return;
      }
      void (async () => {
        try {
          await deleteWorkspaceJobs(workflowId, "all");
          state.workspaceJobSelection = { pending: [], queued: [], completed: [] };
          setState({
            notice: "Deleted all workflow jobs.",
            error: "",
            workspaceError: "",
            selectedJob: null,
            jobDetailOpen: false,
            selectedWorkspaceTranscription: null,
            selectedWorkspaceTranscriptionId: null,
          });
          await loadWorkspace(workflowId);
        } catch (error) {
          setState({ workspaceError: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "queue-selected-jobs") {
      void updateWorkspaceJobs({
        action: "queue",
        jobIds: workspaceJobSelection("pending"),
        notice: "Pending jobs queued.",
      });
    }
    if (action === "unqueue-selected-jobs") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: workspaceJobSelection("queued"),
        notice: "Queued jobs moved back to pending.",
      });
    }
    if (action === "retry-selected-jobs") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: workspaceJobSelection("completed"),
        notice: "Completed jobs marked for retry.",
      });
    }
    if (action === "assemble-transcriptions") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      void (async () => {
        try {
          await createWorkspaceTranscriptions(workflowId);
          setState({ notice: "Transcriptions assembled.", error: "", workspaceError: "" });
          await loadWorkspace(workflowId);
        } catch (error) {
          setState({ workspaceError: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "score-transcriptions") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return;
      }
      void (async () => {
        try {
          await scoreWorkspace(workflowId);
          setState({ notice: "Transcriptions scored.", error: "", workspaceError: "" });
          await loadWorkspace(workflowId);
        } catch (error) {
          setState({ workspaceError: error instanceof Error ? error.message : String(error) });
        }
      })();
    }
    if (action === "prototype-nav") {
      const navKey = actionTarget.dataset.navKey || "dashboard";
      if (navKey === "workflow-workspace") {
        if (state.selectedWorkflowId) {
          void openWorkspaceForWorkflow(state.selectedWorkflowId);
          return;
        }

        setState({
          prototypeNav: navKey,
          ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
        });
        return;
      }

      closeWorkspaceEventSocket();
      setState({
        prototypeNav: navKey,
        ...resetWorkspaceState(),
      });
    }
    if (action === "open-group-detail") {
      setState({
        selectedGroupName: actionTarget.dataset.groupName,
        groupDetailOpen: true,
        valueOpen: false,
      });
    }
    if (action === "open-value") {
      setState({ valueOpen: true, valueDraft: defaultValueDraft() });
    }
    if (action === "edit-value") {
      openValueEditor(actionTarget.dataset.valueName);
    }
    if (action === "close-value") {
      setState({ valueOpen: false, valueDraft: defaultValueDraft() });
    }
    if (action === "open-sample") {
      void openSample(actionTarget.dataset.sampleId);
    }
    if (action === "open-job") {
      void openJobDetail(actionTarget.dataset.jobId);
    }
    if (action === "queue-job") {
      void updateWorkspaceJobs({
        action: "queue",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job queued.",
      });
    }
    if (action === "unqueue-job") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job moved back to pending.",
      });
    }
    if (action === "retranscribe-job") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job marked for retranscription.",
      });
    }
    if (action === "close-job-detail") {
      setState({ jobDetailOpen: false, selectedJob: null });
    }
    if (action === "select-workflow-samples-visible") {
      selectVisibleWorkflowSamples();
    }
    if (action === "select-group-samples-visible") {
      selectVisibleGroupSamples();
    }
    if (action === "select-value-samples-visible") {
      selectVisibleValueSamples();
    }
    if (action === "apply-group-filter") {
      render();
    }
    if (action === "apply-value-filter") {
      render();
    }
    if (action === "apply-workflow-filter") {
      render();
    }
    if (action === "clear-workflow-samples") {
      clearWorkflowSamples();
    }
    if (action === "set-file-management-mode") {
      setState({
        fileManagementMode: actionTarget.dataset.fileManagementMode || "create-grouping",
        fileManagementSelection: [],
      });
    }
    if (action === "apply-file-management-filter") {
      state.appliedFileManagementQuery = state.fileManagementQuery;
      state.appliedFileManagementQueryMode = state.fileManagementQueryMode;
      state.appliedFileManagementGroupFilter = state.fileManagementGroupFilter;
      state.appliedFileManagementGroupFilterValue = state.fileManagementGroupFilterValue;
      state.fileManagementSelection = [];
      render();
    }
    if (action === "select-all-file-management") {
      state.fileManagementSelection = visibleFileManagementSampleIds();
      render();
    }
    if (action === "add-schema-field") {
      addSchemaField();
    }
    if (action === "remove-schema-field") {
      removeSchemaField(Number(actionTarget.dataset.schemaIndex));
    }
    if (action === "wizard-next") {
      if (state.wizardStep === 0 && !state.workflowDraft.workflow_name.trim()) {
        setState({ error: "Workflow name is required." });
        return;
      }
      if (state.wizardStep === 1 && !state.workflowDraft.sample_set_id) {
        setState({ error: "Sample set is required." });
        return;
      }
      setState({ wizardStep: Math.min(2, state.wizardStep + 1), error: "" });
    }
    if (action === "wizard-back") setState({ wizardStep: Math.max(0, state.wizardStep - 1) });
    if (action === "add-example") {
      state.workflowDraft.examples.push({ title: "", instruction_text: "", assets: "" });
      render();
    }
    if (action === "remove-example") {
      const index = Number(actionTarget.dataset.exampleIndex);
      state.workflowDraft.examples.splice(index, 1);
      if (!state.workflowDraft.examples.length) {
        state.workflowDraft.examples.push({ title: "", instruction_text: "", assets: "" });
      }
      render();
    }
  }

  function onPointerDown(event) {
    const sampleTarget = event.target.closest("[data-workflow-sample]");
    if (!sampleTarget || !state.workflowWizardOpen || state.wizardStep !== 1) return;
    event.preventDefault();

    const sampleId = sampleTarget.dataset.workflowSample;
    const shouldInclude = !state.workflowDraft.sample_ids.includes(sampleId);
    const selectionMode = state.workflowDraft.input_mode === "single" ? "single" : "batch";
    state.workflowSampleDrag = {
      active: true,
      shouldInclude,
      selectionMode,
      lastSampleId: sampleId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    state.workflowSampleClickSuppressed = true;
    setWorkflowSampleSelection(sampleId, shouldInclude, { rerender: selectionMode === "single" });
    if (selectionMode === "batch") {
      startWorkflowSelectionAutoScroll();
      selectWorkflowSampleAtPoint(event.clientX, event.clientY);
    }
  }

  function onPointerMove(event) {
    if (!state.workflowSampleDrag?.active || state.workflowDraft.input_mode === "single") return;
    if (!(event.buttons & 1)) return;
    state.workflowSampleDrag.clientX = event.clientX;
    state.workflowSampleDrag.clientY = event.clientY;
    startWorkflowSelectionAutoScroll();
    selectWorkflowSampleAtPoint(event.clientX, event.clientY);
  }

  function onPointerUp() {
    if (!state.workflowSampleDrag?.active) return;
    state.workflowSampleDrag = null;
    stopWorkflowSelectionAutoScroll();
    window.setTimeout(() => {
      state.workflowSampleClickSuppressed = false;
    }, 0);
  }

  function onInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    if (target.dataset.workspaceReviewField === "query") {
      state.workspaceReviewQuery = target.value;
      render();
      return;
    }
    if (target.dataset.field === "sample-query") {
      state.sampleQuery = target.value;
      window.clearTimeout(state.sampleSearchTimer);
      state.sampleSearchTimer = window.setTimeout(() => loadDashboard(), 250);
    }
    if (target.dataset.field === "sample-group-filter") {
      state.sampleGroupFilter = target.value;
      render();
    }
    if (updateFilterField(target)) {
      return;
    }
    if (target.dataset.fileManagementDraft) {
      state.fileManagementDraft[target.dataset.fileManagementDraft] = target.value;
      return;
    }
    if (target.dataset.draft) state.workflowDraft[target.dataset.draft] = target.value;
    if (target.dataset.draft === "input_mode") {
      state.workflowDraft.input_mode = target.value === "single" ? "single" : "batch";
      state.workflowDraft.output_format_type = state.workflowDraft.input_mode === "single" ? "plain_text" : "json_array";
      if (state.workflowDraft.input_mode === "batch") {
        seedBatchSchemaIfEmpty();
      }
      if (state.workflowDraft.input_mode === "single" && state.workflowDraft.sample_ids.length > 1) {
        state.workflowDraft.sample_ids = state.workflowDraft.sample_ids.slice(0, 1);
        render();
      }
    }
    if (target.dataset.draft === "batch_size") {
      state.workflowDraft.batch_size = Math.max(1, Number(target.value) || 1);
    }
    if (target.dataset.fileManagementSelection !== undefined) {
      toggleListValue(state.fileManagementSelection, target.dataset.fileManagementSelection, target.checked);
      render();
      return;
    }
    if (target.dataset.exampleField) {
      state.workflowDraft.examples[Number(target.dataset.exampleIndex)][target.dataset.exampleField] = target.value;
    }
    if (target.dataset.schemaField) {
      state.workflowDraft.item_schema_entries[Number(target.dataset.schemaIndex)][target.dataset.schemaField] = target.value;
    }
    if (target.id === "group-name") state.groupDraft.name = target.value;
    if (target.id === "value-name") state.valueDraft.value = target.value;
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.dataset.workspaceReviewField === "sort") {
      state.workspaceReviewSort = target.value;
      render();
      return;
    }
    if (target.id === "workspace-workflow-select") {
      state.workspacePickerWorkflowId = Number(target.value) || null;
      state.workspaceError = "";
      const openButton = root.querySelector('[data-action="open-selected-workflow"]');
      if (openButton) {
        openButton.disabled = !state.workspacePickerWorkflowId;
      }
      return;
    }
    if (target.dataset.draft === "selection_group_name") {
      state.workflowDraft.selection_group_name = target.value;
      state.workflowDraft.selection_group_value = "";
      render();
      return;
    }
    if (target.dataset.draft === "selection_group_value") {
      state.workflowDraft.selection_group_value = target.value;
      render();
      return;
    }
    if (target.dataset.draft === "sample_set_id") {
      const sampleSetId = Number(target.value) || null;
      const sampleSet = state.sampleSets.find((item) => Number(item.sample_set_id) === sampleSetId) || null;
      state.workflowDraft.sample_set_id = sampleSetId;
      state.workflowDraft.sample_ids = Array.isArray(sampleSet?.sample_ids) ? [...sampleSet.sample_ids] : [];
      render();
      return;
    }
    if (target.dataset.draft === "input_mode") {
      state.workflowDraft.input_mode = target.value === "single" ? "single" : "batch";
      state.workflowDraft.output_format_type = state.workflowDraft.input_mode === "single" ? "plain_text" : "json_array";
      if (state.workflowDraft.input_mode === "batch") {
        seedBatchSchemaIfEmpty();
      }
      if (state.workflowDraft.input_mode === "single" && state.workflowDraft.sample_ids.length > 1) {
        state.workflowDraft.sample_ids = state.workflowDraft.sample_ids.slice(0, 1);
      }
      render();
      return;
    }
    if (target.dataset.draft === "output_format_type") {
      state.workflowDraft.output_format_type = target.value;
      render();
      return;
    }
    if (target.dataset.draft === "batch_size") {
      state.workflowDraft.batch_size = Math.max(1, Number(target.value) || 1);
      return;
    }

    if (target.dataset.groupSample !== undefined) {
      toggleListValue(state.groupDraft.sample_ids, target.dataset.groupSample, target.checked);
      render();
      return;
    }
    if (target.dataset.valueSample !== undefined) {
      toggleListValue(state.valueDraft.sample_ids, target.dataset.valueSample, target.checked);
      render();
      return;
    }
    if (updateFilterField(target, { rerender: target instanceof HTMLSelectElement })) {
      return;
    }
  }

  function onSubmit(event) {
    if (event.target.id === "upload-form") {
      event.preventDefault();
      void submitUpload(event.target);
    }
    if (event.target.id === "group-form") {
      event.preventDefault();
      void submitGroup();
    }
    if (event.target.id === "value-form") {
      event.preventDefault();
      void submitValue();
    }
    if (event.target.id === "file-management-form") {
      event.preventDefault();
      void submitFileManagement();
    }
    if (event.target.id === "workflow-form") {
      event.preventDefault();
      void submitWorkflow();
    }
  }
}

function createInitialState() {
  return {
    workflows: [],
    samples: [],
    groupings: [],
    view: "dashboard",
    prototypeNav: "dashboard",
    selectedWorkflowId: null,
    workspacePickerWorkflowId: null,
    selectedSampleSetId: null,
    selectedGroupName: null,
    selectedSample: null,
    sampleQuery: "",
    sampleGroupFilter: "",
    fileManagementQuery: "",
    fileManagementQueryMode: "contains",
    fileManagementGroupFilter: "",
    fileManagementGroupFilterValue: "",
    appliedFileManagementQuery: "",
    appliedFileManagementQueryMode: "contains",
    appliedFileManagementGroupFilter: "",
    appliedFileManagementGroupFilterValue: "",
    fileManagementSelection: [],
    loading: false,
    error: "",
    notice: "",
    groupDraft: defaultGroupDraft(),
    valueDraft: defaultValueDraft(),
    workflowWizardOpen: false,
    uploadOpen: false,
    uploadMode: "single",
    groupOpen: false,
    groupDetailOpen: false,
    valueOpen: false,
    sampleDetailOpen: false,
    fileManagementMode: "create-grouping",
    fileManagementDraft: {
      grouping_name: "",
      sample_set_name: "",
      sample_set_type: "",
      sample_set_description: "",
      grouping_value_group_name: "",
      grouping_value_name: "",
    },
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
    workspaceEventSocket: null,
    workspaceEventReconnectTimer: null,
    sampleSetAnalytics: null,
    sampleSetAnalyticsLoading: false,
    sampleSetAnalyticsError: "",
    wizardStep: 0,
    workflowDraft: defaultWorkflowDraft(),
    sampleSearchTimer: null,
    workflowSampleDrag: null,
    workflowSelectionScrollFrame: null,
    workflowSampleClickSuppressed: false,
    sampleSets: [],
  };
}
