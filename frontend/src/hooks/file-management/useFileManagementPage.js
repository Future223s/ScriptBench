"use client";

import { useEffect, useRef, useState } from "react";

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
    derivatives: [],
    derivativeGroups: [],
    assets: [],
  };
}

export function useFileManagementPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshingDerivativeMappings, setRefreshingDerivativeMappings] =
    useState(false);
  const [catalogs, setCatalogs] = useState(createCatalogState);
  const [collectionSelections, setCollectionSelections] = useState({
    sampleSet: [],
    derivativeGroup: [],
  });
  const derivativeMappingStarted = useRef(false);

  function setSharedError(message) {
    setError(message);
  }

  const browser = useFileBrowser(catalogs);
  const detail = useFileDetail({ setError: setSharedError, derivativeGroups: catalogs.derivativeGroups });
  const selectionActions = useFileSelectionActions();
  const upload = useFileUpload();

  async function refresh() {
    setLoading(true);
    setSharedError("");

    const [
      samplesResult,
      sampleSetsResult,
      derivativesResult,
      derivativeGroupsResult,
      assetsResult,
    ] = await Promise.allSettled([
      fileManagementApi.getSamples(),
      fileManagementApi.getSampleSets(),
      fileManagementApi.getDerivatives(),
      fileManagementApi.getDerivativeGroups(),
      fileManagementApi.getAssets(),
    ]);

    const failures = [];
    if (samplesResult.status === "rejected")
      failures.push(samplesResult.reason);
    if (sampleSetsResult.status === "rejected")
      failures.push(sampleSetsResult.reason);
    if (derivativesResult.status === "rejected")
      failures.push(derivativesResult.reason);
    if (derivativeGroupsResult.status === "rejected")
      failures.push(derivativeGroupsResult.reason);
    if (assetsResult.status === "rejected") failures.push(assetsResult.reason);

    setCatalogs({
      samples:
        samplesResult.status === "fulfilled"
          ? samplesResult.value.samples || []
          : [],
      sampleSets:
        sampleSetsResult.status === "fulfilled"
          ? sampleSetsResult.value.sample_sets || []
          : [],
      derivatives:
        derivativesResult.status === "fulfilled"
          ? derivativesResult.value.derivatives || []
          : [],
      derivativeGroups:
        derivativeGroupsResult.status === "fulfilled"
          ? derivativeGroupsResult.value.derivative_groups || []
          : [],
      assets:
        assetsResult.status === "fulfilled"
          ? assetsResult.value.assets || []
          : [],
    });
    setLoading(false);
    setSharedError(
      failures.length
        ? failures[0] instanceof Error
          ? failures[0].message
          : String(failures[0])
        : "",
    );
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (loading || derivativeMappingStarted.current || !catalogs.derivatives.length)
      return;
    derivativeMappingStarted.current = true;
    void refreshDerivativeMappings();
  }, [loading, catalogs.derivatives]);

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

  function toggleCollectionSelection(type, recordId, selected) {
    const normalizedId = String(recordId);
    setCollectionSelections((current) => ({
      ...current,
      [type]: selected
        ? [...new Set([...current[type], normalizedId])]
        : current[type].filter((id) => id !== normalizedId),
    }));
  }

  async function deleteSelectedCollections(type) {
    const selectedIds = collectionSelections[type] || [];
    if (!selectedIds.length) return;
    const label = type === "sampleSet" ? "sample sets" : "derivative groups";
    if (
      !window.confirm(
        `Delete ${selectedIds.length} ${label}? This cannot be undone.`,
      )
    )
      return;
    try {
      if (type === "sampleSet") {
        await Promise.all(
          selectedIds.map((id) => fileManagementApi.deleteSampleSet(id)),
        );
      } else {
        await Promise.all(
          selectedIds.map((id) => fileManagementApi.deleteDerivativeGroup(id)),
        );
      }
      setCollectionSelections((current) => ({ ...current, [type]: [] }));
      setNotice(`${selectedIds.length} ${label} deleted.`);
      await refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (deleteError) {
      setSharedError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  }

  async function refreshDerivativeMappings() {
    const derivativeRecords = catalogs.derivatives;

    try {
      setRefreshingDerivativeMappings(true);
      setSharedError("");
      setNotice("");
      const mappedResponse = await fileManagementApi.mapDerivatives(
        derivativeRecords.map((record) => ({
          id: record.id,
          name: record.name,
        })),
      );
      const mappedDerivatives = mappedResponse.data?.mapped_derivatives || [];
      if (!mappedDerivatives.length) {
        const firstRejected = mappedResponse.data?.rejected_derivatives?.[0];
        throw new Error(
          String(firstRejected?.reason || "No derivatives could be remapped."),
        );
      }

      await fileManagementApi.patchDerivatives(
        mappedDerivatives.map((derivative) => ({
          id: derivative.id,
          derivative_group_id: derivative.derivative_group_id,
          sample_id: derivative.sample_id,
        })),
      );
      setNotice(`Refreshed ${mappedDerivatives.length} derivative mappings.`);
      await refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (error) {
      setSharedError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshingDerivativeMappings(false);
    }
  }

  const state = {
    loading,
    error,
    notice,
    refreshingDerivativeMappings,
    ...catalogs,
    ...browser.state,
    ...selectionActions.state,
    ...detail.state,
    ...upload.state,
    collectionSelections,
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
      upload.actions.openUploadPanel(browser.state.managementType);
    },
    closeUploadPanel: upload.actions.closeUploadPanel,
    setFilterField: browser.actions.setFilterField,
    setDraftField: selectionActions.actions.setDraftField,
    toggleSelection: selectionActions.actions.toggleSelection,
    selectAllVisible: () =>
      selectionActions.actions.selectAllVisible(
        browser.state.managementType,
        browser.state.visibleRecords,
        recordIdForType,
      ),
    clearSelection: selectionActions.actions.clearSelection,
    toggleCollectionSelection,
    deleteSelectedCollections,
    openRecord: detail.actions.openRecord,
    closeRecordDetail: detail.actions.closeRecordDetail,
    deleteRecord: (type, recordId) =>
      selectionActions.actions.deleteRecord(type, recordId, {
        closeDetailIfMatching,
        refresh,
        setError: setSharedError,
        setNotice,
      }),
    submitUpload: () =>
      upload.actions.submitUpload({
        refresh,
        setError: setSharedError,
        setNotice,
      }),
    submitManagement: (actionOverride = null) =>
      selectionActions.actions.submitManagement({
        type: browser.state.managementType,
        action: actionOverride || browser.state.managementAction,
        visibleIds: browser.state.visibleRecords.map((record) =>
          recordIdForType(browser.state.managementType, record),
        ),
        effects: {
          closeDetailIfMatching,
          refresh,
          setError: setSharedError,
          setNotice,
        },
      }),
  };

  return { state, actions };
}
