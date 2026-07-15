"use client";

import { useEffect, useState } from "react";

import { fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";
import { recordIdForType } from "./fileManagementShared.js";
import { useFileBrowser } from "./useFileBrowser.js";
import { useFileDetail } from "./useFileDetail.js";
import { useFileSelectionActions } from "./useFileSelectionActions.js";
import { useFileUpload } from "./useFileUpload.js";

function createCatalogState() {
  return {
    samples: [],
    sampleSets: [],
    artifacts: [],
    artifactGroups: [],
    assets: [],
  };
}

export function useFileManagementPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshingArtifactMappings, setRefreshingArtifactMappings] = useState(false);
  const [catalogs, setCatalogs] = useState(createCatalogState);

  function setSharedError(message) {
    setError(message);
  }

  const browser = useFileBrowser(catalogs);
  const detail = useFileDetail({ setError: setSharedError });
  const selectionActions = useFileSelectionActions();
  const upload = useFileUpload();

  async function refresh() {
    setLoading(true);
    setSharedError("");

    const [samplesResult, sampleSetsResult, artifactsResult, artifactGroupsResult, assetsResult] = await Promise.allSettled([
      fileManagementApi.getSamples(),
      fileManagementApi.getSampleSets(),
      fileManagementApi.getArtifacts(),
      fileManagementApi.getArtifactGroups(),
      fileManagementApi.getAssets(),
    ]);

    const failures = [];
    if (samplesResult.status === "rejected") failures.push(samplesResult.reason);
    if (sampleSetsResult.status === "rejected") failures.push(sampleSetsResult.reason);
    if (artifactsResult.status === "rejected") failures.push(artifactsResult.reason);
    if (artifactGroupsResult.status === "rejected") failures.push(artifactGroupsResult.reason);
    if (assetsResult.status === "rejected") failures.push(assetsResult.reason);

    setCatalogs({
      samples: samplesResult.status === "fulfilled" ? samplesResult.value.samples || [] : [],
      sampleSets: sampleSetsResult.status === "fulfilled" ? sampleSetsResult.value.sample_sets || [] : [],
      artifacts: artifactsResult.status === "fulfilled" ? artifactsResult.value.artifacts || [] : [],
      artifactGroups: artifactGroupsResult.status === "fulfilled" ? artifactGroupsResult.value.artifact_groups || [] : [],
      assets: assetsResult.status === "fulfilled" ? assetsResult.value.assets || [] : [],
    });
    setLoading(false);
    setSharedError(failures.length ? (failures[0] instanceof Error ? failures[0].message : String(failures[0])) : "");
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("file-management-page", [
      { kind: "error", message: error },
      { kind: "success", message: notice },
    ]);
  }, [syncNotifications, error, notice]);

  function closeDetailIfMatching(type) {
    if (detail.state.detailOpen && detail.state.detailType === type) {
      detail.actions.closeRecordDetail();
    }
  }

  async function refreshArtifactMappings() {
    const artifactRecords = browser.state.visibleRecords;
    if (!artifactRecords.length) {
      setSharedError("No artifacts available to refresh.");
      return;
    }

    try {
      setRefreshingArtifactMappings(true);
      setSharedError("");
      setNotice("");
      const mappedResponse = await fileManagementApi.mapArtifacts(
        artifactRecords.map((record) => ({
          artifact_id: record.artifact_id,
          artifact_name: record.artifact_name,
        })),
      );
      const mappedArtifacts = mappedResponse.data?.mapped_artifacts || [];
      if (!mappedArtifacts.length) {
        const firstRejected = mappedResponse.data?.rejected_artifacts?.[0];
        throw new Error(String(firstRejected?.reason || "No artifacts could be remapped."));
      }

      await fileManagementApi.patchArtifacts(mappedArtifacts.map((artifact) => ({
        artifact_id: artifact.artifact_id,
        artifact_group_id: artifact.artifact_group_id,
        artifact_group_name: artifact.artifact_group_name,
        originating_sample_id: artifact.originating_sample_id,
      })));
      setNotice(`Refreshed ${mappedArtifacts.length} artifact mappings.`);
      await refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (error) {
      setSharedError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshingArtifactMappings(false);
    }
  }

  const state = {
    loading,
    error,
    notice,
    refreshingArtifactMappings,
    ...catalogs,
    ...browser.state,
    ...selectionActions.state,
    ...detail.state,
    ...upload.state,
  };

  const actions = {
    refresh,
    setUploadType: upload.actions.setUploadType,
    setUploadMode: upload.actions.setUploadMode,
    setUploadField: upload.actions.setUploadField,
    setUploadFiles: upload.actions.setUploadFiles,
    setManagementType: (type) => {
      browser.actions.setManagementType(type);
      detail.actions.closeRecordDetail();
      selectionActions.actions.closeManagementModal();
    },
    openManagementModal: () => {
      upload.actions.closeUploadPanel();
      selectionActions.actions.openManagementModal();
    },
    closeManagementModal: selectionActions.actions.closeManagementModal,
    openUploadPanel: () => {
      selectionActions.actions.closeManagementModal();
      upload.actions.openUploadPanel();
    },
    closeUploadPanel: upload.actions.closeUploadPanel,
    setFilterField: browser.actions.setFilterField,
    clearFilters: browser.actions.clearFilters,
    applyFilters: browser.actions.applyFilters,
    setDraftField: selectionActions.actions.setDraftField,
    toggleSelection: selectionActions.actions.toggleSelection,
    selectAllVisible: () => selectionActions.actions.selectAllVisible(
      browser.state.managementType,
      browser.state.visibleRecords,
      recordIdForType,
    ),
    clearSelection: selectionActions.actions.clearSelection,
    openRecord: detail.actions.openRecord,
    closeRecordDetail: detail.actions.closeRecordDetail,
    deleteRecord: (type, recordId) => selectionActions.actions.deleteRecord(type, recordId, {
      closeDetailIfMatching,
      refresh,
      setError: setSharedError,
      setNotice,
    }),
    submitUpload: () => upload.actions.submitUpload({
      refresh,
      setError: setSharedError,
      setNotice,
    }),
    submitManagement: (actionOverride = null) => selectionActions.actions.submitManagement({
      type: browser.state.managementType,
      action: actionOverride || browser.state.managementAction,
      visibleIds: browser.state.visibleRecords.map((record) => recordIdForType(browser.state.managementType, record)),
      effects: {
        closeDetailIfMatching,
        refresh,
        setError: setSharedError,
        setNotice,
      },
    }),
    refreshArtifactMappings,
  };

  return { state, actions };
}
