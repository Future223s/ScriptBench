export function createWorkspaceActions(ctx) {
  const {
    setState,
    loadWorkspace,
    loadWorkspaceTranscriptionDetail,
    openWorkspaceForWorkflow,
    openJobDetail,
    updateWorkspaceJobs,
    workspaceJobSelection,
    workspaceJobsByKind,
    setWorkspaceJobSelection,
    deleteWorkspaceJobs,
    selectVisibleWorkflowSamples,
    selectVisibleGroupSamples,
    selectVisibleValueSamples,
    createWorkspaceTranscriptions,
    scoreWorkspace,
    selectedWorkflow,
    refreshCurrentView,
    closeWorkspaceEventSocket,
    resetWorkspaceState,
    state,
  } = ctx;

  function handleClick(action, actionTarget) {
    if (action === "close-workspace") {
      closeWorkspaceEventSocket();
      setState({
        prototypeNav: "dashboard",
        ...resetWorkspaceState(),
      });
      return true;
    }
    if (action === "workspace-pane") {
      setState({ workspacePane: actionTarget.dataset.workspacePane || "jobs" });
      return true;
    }
    if (action === "toggle-review-compare") {
      setState({ workspaceReviewCompareExpanded: !state.workspaceReviewCompareExpanded });
      return true;
    }
    if (action === "select-transcription") {
      const transcriptionId = Number(actionTarget.dataset.transcriptionId);
      if (!transcriptionId) return true;
      setState({ selectedWorkspaceTranscriptionId: transcriptionId });
      void loadWorkspaceTranscriptionDetail(transcriptionId);
      return true;
    }
    if (action === "toggle-workspace-job") {
      const status = actionTarget.dataset.jobStatus;
      const jobId = Number(actionTarget.dataset.jobId);
      if (!status || !jobId) return true;
      const shouldInclude = actionTarget instanceof HTMLInputElement ? actionTarget.checked : !workspaceJobSelection(status).includes(jobId);
      setWorkspaceJobSelection(status, jobId, shouldInclude);
      return true;
    }
    if (action === "select-visible-workspace-jobs") {
      const status = actionTarget.dataset.jobStatus;
      if (!status) return true;
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
      ctx.render();
      return true;
    }
    if (action === "delete-pending-jobs" || action === "delete-queued-jobs" || action === "delete-completed-jobs") {
      const kind = action === "delete-pending-jobs" ? "pending" : action === "delete-queued-jobs" ? "queued" : "completed";
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return true;
      }
      const count = workspaceJobsByKind(kind).length;
      const label = kind === "pending" ? "pending" : kind === "queued" ? "queued" : "completed";
      if (!window.confirm(`Delete all ${label} jobs? This will remove the jobs and any assembled transcriptions linked to them.`)) {
        return true;
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
      return true;
    }
    if (action === "delete-workspace-jobs") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return true;
      }
      const totalJobs = workspaceJobsByKind("pending").length + workspaceJobsByKind("queued").length + workspaceJobsByKind("completed").length;
      if (!totalJobs) {
        setState({ notice: "No jobs to delete.", error: "", workspaceError: "" });
        return true;
      }
      if (!window.confirm("Delete all jobs in this workflow? This will remove the jobs and any assembled transcriptions linked to them.")) {
        return true;
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
      return true;
    }
    if (action === "queue-selected-jobs") {
      void updateWorkspaceJobs({
        action: "queue",
        jobIds: workspaceJobSelection("pending"),
        notice: "Pending jobs queued.",
      });
      return true;
    }
    if (action === "unqueue-selected-jobs") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: workspaceJobSelection("queued"),
        notice: "Queued jobs moved back to pending.",
      });
      return true;
    }
    if (action === "retry-selected-jobs") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: workspaceJobSelection("completed"),
        notice: "Completed jobs marked for retry.",
      });
      return true;
    }
    if (action === "assemble-transcriptions") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return true;
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
      return true;
    }
    if (action === "score-transcriptions") {
      const workflowId = state.selectedWorkflowId;
      if (!workflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return true;
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
      return true;
    }
    if (action === "open-job") {
      void openJobDetail(actionTarget.dataset.jobId);
      return true;
    }
    if (action === "queue-job") {
      void updateWorkspaceJobs({
        action: "queue",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job queued.",
      });
      return true;
    }
    if (action === "unqueue-job") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job moved back to pending.",
      });
      return true;
    }
    if (action === "retranscribe-job") {
      void updateWorkspaceJobs({
        action: "retry",
        jobIds: [Number(actionTarget.dataset.jobId)],
        notice: "Job marked for retranscription.",
      });
      return true;
    }
    if (action === "prototype-nav") {
      const navKey = actionTarget.dataset.navKey || "dashboard";
      if (navKey === "workflow-workspace") {
        if (state.selectedWorkflowId) {
          void openWorkspaceForWorkflow(state.selectedWorkflowId);
          return true;
        }

        setState({
          prototypeNav: navKey,
          ...resetWorkspaceState({ keepSelectedWorkflowId: false }),
        });
        return true;
      }

      closeWorkspaceEventSocket();
      setState({
        prototypeNav: navKey,
        ...resetWorkspaceState(),
      });
      return true;
    }
    if (action === "select-workflow-samples-visible") {
      selectVisibleWorkflowSamples();
      return true;
    }
    if (action === "select-group-samples-visible") {
      selectVisibleGroupSamples();
      return true;
    }
    if (action === "select-value-samples-visible") {
      selectVisibleValueSamples();
      return true;
    }
    return false;
  }

  return { handleClick };
}
