"use client";

import { useEffect, useState } from "react";

import { deleteSampleSet as deleteSampleSetRequest, deleteWorkflow as deleteWorkflowRequest, getSampleSetAnalytics, getSampleSets } from "../../services/dashboardService.js";

export function useDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    notice: "",
    sampleSets: [],
    selectedSampleSetId: null,
    sampleSetAnalytics: null,
    sampleSetAnalyticsLoading: false,
    sampleSetAnalyticsError: "",
  });

  async function loadDashboard({ keepSelection = true } = {}) {
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    try {
      const sampleSetsResponse = await getSampleSets();

      setState((current) => {
        const sampleSets = sampleSetsResponse.sample_sets || [];
        const selectedSampleSetId = keepSelection && sampleSets.some((sampleSet) => Number(sampleSet.sample_set_id) === Number(current.selectedSampleSetId))
          ? current.selectedSampleSetId
          : null;

        return {
          ...current,
          loading: false,
          error: "",
          sampleSets,
          selectedSampleSetId,
          sampleSetAnalytics: selectedSampleSetId == null ? null : current.sampleSetAnalytics,
          sampleSetAnalyticsLoading: false,
          sampleSetAnalyticsError: selectedSampleSetId == null ? "" : current.sampleSetAnalyticsError,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        sampleSets: [],
        selectedSampleSetId: null,
        sampleSetAnalytics: null,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: "",
      }));
    }
  }

  async function loadSampleSetAnalytics(sampleSetId) {
    if (sampleSetId == null) {
      setState((current) => ({
        ...current,
        selectedSampleSetId: null,
        sampleSetAnalytics: null,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: "",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      selectedSampleSetId: Number(sampleSetId),
      sampleSetAnalyticsLoading: true,
      sampleSetAnalyticsError: "",
    }));

    try {
      const analytics = await getSampleSetAnalytics(sampleSetId);
      setState((current) => ({
        ...current,
        selectedSampleSetId: Number(sampleSetId),
        sampleSetAnalytics: analytics,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: "",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        selectedSampleSetId: Number(sampleSetId),
        sampleSetAnalytics: null,
        sampleSetAnalyticsLoading: false,
        sampleSetAnalyticsError: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function refresh() {
    const selectedSampleSetId = state.selectedSampleSetId;
    await loadDashboard({ keepSelection: true });
    if (selectedSampleSetId != null) {
      await loadSampleSetAnalytics(selectedSampleSetId);
    }
  }

  async function selectSampleSet(sampleSetId) {
    await loadSampleSetAnalytics(sampleSetId);
  }

  async function removeSampleSet(sampleSetId) {
    if (!sampleSetId) return;
    if (!window.confirm(`Delete sample set ${sampleSetId}? This cannot be undone.`)) return;

    try {
      await deleteSampleSetRequest(sampleSetId);
      setState((current) => ({
        ...current,
        notice: `Deleted sample set ${sampleSetId}.`,
        error: "",
      }));
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function removeWorkflow(workflowId, workflowLabel = "") {
    if (!workflowId) return;
    const label = workflowLabel || `workflow ${workflowId}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      await deleteWorkflowRequest(workflowId);
      setState((current) => ({
        ...current,
        notice: `Deleted ${label}.`,
        error: "",
      }));
      await refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  useEffect(() => {
    void loadDashboard({ keepSelection: false });
  }, []);

  return {
    ...state,
    refresh,
    selectSampleSet,
    removeSampleSet,
    removeWorkflow,
  };
}
