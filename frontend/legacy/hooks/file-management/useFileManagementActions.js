export function createFileManagementActions(ctx) {
  const {
    setState,
    defaultValueDraft,
    defaultGroupDraft,
    deleteSample,
    deleteGrouping,
    openSample,
    openValueEditor,
    selectVisibleGroupSamples,
    selectVisibleValueSamples,
    closeModals,
    selectedGrouping,
    loadDashboard,
    visibleFileManagementSampleIds,
    state,
  } = ctx;

  function handleClick(action, actionTarget) {
    if (action === "open-upload") {
      setState({ uploadOpen: true });
      return true;
    }
    if (action === "set-upload-mode") {
      setState({ uploadMode: actionTarget.dataset.uploadMode || "single" });
      return true;
    }
    if (action === "open-group") {
      setState({ groupOpen: true, groupDraft: defaultGroupDraft() });
      return true;
    }
    if (action === "open-group-detail") {
      setState({
        selectedGroupName: actionTarget.dataset.groupName,
        groupDetailOpen: true,
        valueOpen: false,
      });
      return true;
    }
    if (action === "open-value") {
      setState({ valueOpen: true, valueDraft: defaultValueDraft() });
      return true;
    }
    if (action === "edit-value") {
      openValueEditor(actionTarget.dataset.valueName);
      return true;
    }
    if (action === "close-value") {
      setState({ valueOpen: false, valueDraft: defaultValueDraft() });
      return true;
    }
    if (action === "open-sample") {
      void openSample(actionTarget.dataset.sampleId);
      return true;
    }
    if (action === "delete-sample") {
      const sampleId = actionTarget.dataset.sampleId;
      if (!sampleId) return true;
      if (!window.confirm(`Delete sample ${sampleId}? This cannot be undone.`)) return true;

      void (async () => {
        try {
          await deleteSample(sampleId);
          setState({
            notice: `Deleted sample ${sampleId}.`,
            error: "",
            sampleDetailOpen: false,
            selectedSample: null,
          });
          await ctx.refreshCurrentView();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true;
    }
    if (action === "delete-group") {
      const groupName = actionTarget.dataset.groupName;
      if (!groupName) return true;
      if (!window.confirm(`Delete grouping ${groupName}? This cannot be undone.`)) return true;

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
          await ctx.refreshCurrentView();
        } catch (error) {
          setState({ error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true;
    }
    if (action === "close-modals") {
      closeModals();
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
    if (action === "apply-group-filter" || action === "apply-value-filter" || action === "apply-file-management-filter") {
      if (action === "apply-file-management-filter") {
        state.appliedFileManagementQuery = state.fileManagementQuery;
        state.appliedFileManagementQueryMode = state.fileManagementQueryMode;
        state.appliedFileManagementGroupFilter = state.fileManagementGroupFilter;
        state.appliedFileManagementGroupFilterValue = state.fileManagementGroupFilterValue;
        state.fileManagementSelection = [];
      }
      ctx.render();
      return true;
    }
    if (action === "set-file-management-mode") {
      setState({
        fileManagementMode: actionTarget.dataset.fileManagementMode || "create-grouping",
        fileManagementSelection: [],
      });
      return true;
    }
    if (action === "select-all-file-management") {
      state.fileManagementSelection = visibleFileManagementSampleIds();
      ctx.render();
      return true;
    }
    return false;
  }

  return { handleClick };
}
