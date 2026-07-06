export function createDashboardActions(ctx) {
  const {
    setState,
    stopWorkflowSelectionAutoScroll,
    defaultWorkflowDraft,
    loadSampleSetAnalytics,
    openWorkspaceForWorkflow,
    selectedWorkflow,
    deleteWorkflow,
    refreshCurrentView,
    loadDashboard,
    state,
  } = ctx;

  function handleClick(action, actionTarget) {
    if (action === "refresh") {
      void refreshCurrentView();
      return true;
    }
    if (action === "open-workflow") {
      stopWorkflowSelectionAutoScroll();
      setState({
        workflowWizardOpen: true,
        wizardStep: 0,
        workflowDraft: defaultWorkflowDraft(),
        workflowSampleDrag: null,
        workflowSampleClickSuppressed: false,
      });
      return true;
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
      return true;
    }
    if (action === "open-workspace") {
      const workflowId = actionTarget.dataset.workflowId;
      if (!workflowId) return true;
      void openWorkspaceForWorkflow(workflowId);
      return true;
    }
    if (action === "open-selected-workflow") {
      if (!state.workspacePickerWorkflowId) {
        setState({ workspaceError: "Select a workflow first." });
        return true;
      }
      void openWorkspaceForWorkflow(state.workspacePickerWorkflowId);
      return true;
    }
    if (action === "delete-workflow") {
      const workflowId = Number(actionTarget.dataset.workflowId);
      const workflow = state.workflows.find((item) => Number(item.workflow_id) === workflowId);
      const workflowLabel = workflow?.workflow_name || `workflow ${workflowId}`;
      if (!window.confirm(`Delete ${workflowLabel}? This cannot be undone.`)) return true;

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
      return true;
    }
    if (action === "select-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      if (!sampleSetId) return true;
      setState({
        prototypeNav: "dashboard",
        selectedSampleSetId: sampleSetId,
        sampleSetAnalyticsLoading: true,
        sampleSetAnalyticsError: "",
      });
      void loadSampleSetAnalytics(sampleSetId);
      return true;
    }
    if (action === "delete-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      const sampleSet = state.sampleSets.find((item) => Number(item.sample_set_id) === sampleSetId);
      const sampleSetLabel = sampleSet?.sample_set_name || `sample set ${sampleSetId}`;
      if (!sampleSetId) return true;
      if (!window.confirm(`Delete ${sampleSetLabel}? This cannot be undone.`)) return true;

      void (async () => {
        try {
          await ctx.deleteSampleSet(sampleSetId);
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
      return true;
    }
    return false;
  }

  return { handleClick };
}
