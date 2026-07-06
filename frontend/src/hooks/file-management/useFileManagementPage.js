"use client";

import { useEffect, useReducer, useRef } from "react";

import { fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";
import { collectGroundTruthFolderFiles, collectImageFolderFiles } from "../../utils/upload.js";
import { filterSamplesForPicker, visibleWorkflowSamples } from "../../utils/workflow.js";

function createInitialState() {
  return {
    loading: true,
    error: "",
    notice: "",
    samples: [],
    groupings: [],
    sampleSets: [],
    selectedSample: null,
    sampleDetailOpen: false,
    uploadMode: "single",
    fileManagementQuery: "",
    fileManagementQueryMode: "contains",
    fileManagementGroupFilter: "",
    fileManagementGroupFilterValue: "",
    appliedFileManagementQuery: "",
    appliedFileManagementQueryMode: "contains",
    appliedFileManagementGroupFilter: "",
    appliedFileManagementGroupFilterValue: "",
    fileManagementSelection: [],
    fileManagementMode: "create-grouping",
    fileManagementDraft: {
      grouping_name: "",
      sample_set_name: "",
      sample_set_type: "",
      sample_set_description: "",
      grouping_value_group_name: "",
      grouping_value_name: "",
    },
  };
}

export function useFileManagementPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const stateRef = useRef(createInitialState());
  const uploadSampleIdRef = useRef(null);
  const uploadFileRef = useRef(null);
  const uploadGroundTruthRef = useRef(null);
  const uploadImageFolderRef = useRef(null);
  const uploadGroundTruthFolderRef = useRef(null);
  const [, forceRender] = useReducer((value) => value + 1, 0);

  function setState(patch, { render = true } = {}) {
    Object.assign(stateRef.current, patch);
    if (render) {
      forceRender();
    }
  }

  function visibleFileManagementSampleIds() {
    return filterSamplesForPicker(
      visibleWorkflowSamples(
        stateRef.current.samples,
        stateRef.current.groupings,
        stateRef.current.appliedFileManagementGroupFilter,
        stateRef.current.appliedFileManagementGroupFilterValue,
      ),
      stateRef.current.appliedFileManagementQuery,
      stateRef.current.appliedFileManagementQueryMode || "contains",
    ).map((sample) => sample.sample_id);
  }

  function clearUploadInputs() {
    if (uploadSampleIdRef.current) uploadSampleIdRef.current.value = "";
    if (uploadFileRef.current) uploadFileRef.current.value = "";
    if (uploadGroundTruthRef.current) uploadGroundTruthRef.current.value = "";
    if (uploadImageFolderRef.current) uploadImageFolderRef.current.value = "";
    if (uploadGroundTruthFolderRef.current) uploadGroundTruthFolderRef.current.value = "";
  }

  function closeSampleDetail() {
    setState({
      sampleDetailOpen: false,
      selectedSample: null,
    });
  }

  function setUploadMode(uploadMode) {
    setState({ uploadMode: uploadMode === "folder" ? "folder" : "single" });
  }

  function setFileManagementQuery(value) {
    setState({ fileManagementQuery: value });
  }

  function setFileManagementQueryMode(value) {
    setState({
      fileManagementQueryMode: value === "starts-with" ? "starts-with" : value === "exact" ? "exact" : "contains",
    });
  }

  function setFileManagementGroupFilter(value) {
    setState({
      fileManagementGroupFilter: value,
      fileManagementGroupFilterValue: "",
    });
  }

  function setFileManagementGroupFilterValue(value) {
    setState({ fileManagementGroupFilterValue: value });
  }

  function setFileManagementDraftField(field, value) {
    stateRef.current.fileManagementDraft[field] = value;
    forceRender();
  }

  function toggleFileManagementSelection(sampleId, shouldInclude) {
    const selection = stateRef.current.fileManagementSelection;
    const id = String(sampleId);
    const index = selection.indexOf(id);
    if (shouldInclude && index === -1) selection.push(id);
    if (!shouldInclude && index !== -1) selection.splice(index, 1);
    forceRender();
  }

  function applyFileManagementFilter() {
    setState({
      appliedFileManagementQuery: stateRef.current.fileManagementQuery,
      appliedFileManagementQueryMode: stateRef.current.fileManagementQueryMode,
      appliedFileManagementGroupFilter: stateRef.current.fileManagementGroupFilter,
      appliedFileManagementGroupFilterValue: stateRef.current.fileManagementGroupFilterValue,
    });
  }

  function setFileManagementMode(fileManagementMode) {
    setState({
      fileManagementMode: fileManagementMode || "create-grouping",
    });
  }

  function selectAllFileManagement() {
    stateRef.current.fileManagementSelection = visibleFileManagementSampleIds();
    forceRender();
  }

  async function loadFileManagementData() {
    setState({ loading: true, error: "" });

    const [samplesResult, groupingsResult, sampleSetsResult] = await Promise.allSettled([
      fileManagementApi.getSamples(),
      fileManagementApi.getGroupings(),
      fileManagementApi.getSampleSets(),
    ]);

    const samples = samplesResult.status === "fulfilled" ? samplesResult.value : { samples: [] };
    const groupings = groupingsResult.status === "fulfilled" ? groupingsResult.value : { groupings: [] };
    const sampleSets = sampleSetsResult.status === "fulfilled" ? sampleSetsResult.value : { sample_sets: [] };

    setState({
      loading: false,
      samples: samples.samples || [],
      groupings: groupings.groupings || [],
      sampleSets: sampleSets.sample_sets || [],
    });
  }

  async function refresh() {
    await loadFileManagementData();
  }

  async function openSample(sampleId) {
    try {
      const sample = await fileManagementApi.getSample(sampleId);
      setState({ selectedSample: sample, sampleDetailOpen: true, error: "" });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function deleteSample(sampleId) {
    if (!sampleId) return;
    if (!window.confirm(`Delete sample ${sampleId}? This cannot be undone.`)) return;

    try {
      await fileManagementApi.deleteSample(sampleId);
      setState(
        {
          notice: `Deleted sample ${sampleId}.`,
          error: "",
          sampleDetailOpen: false,
          selectedSample: null,
        },
        { render: true },
      );
      await refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitUpload() {
    try {
      const uploadMode = stateRef.current.uploadMode;
      if (uploadMode === "folder") {
        const imageFolderInput = uploadImageFolderRef.current;
        const groundTruthFolderInput = uploadGroundTruthFolderRef.current;
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
          await fileManagementApi.createSample(formData);
          uploadedCount += 1;
          setState({ notice: `Uploaded ${uploadedCount} of ${imageFiles.length} files...`, error: "" });
        }
      } else {
        const sampleId = uploadSampleIdRef.current?.value || "";
        const file = uploadFileRef.current?.files?.[0] || null;
        const groundTruthText = uploadGroundTruthRef.current?.value || "";
        if (!sampleId.trim()) {
          throw new Error("Sample ID is required.");
        }
        if (!file) {
          throw new Error("Select a file first.");
        }

        const formData = new FormData();
        formData.set("sample_id", sampleId);
        formData.set("file", file);
        if (groundTruthText.trim()) {
          formData.set("ground_truth_text", groundTruthText);
        }
        await fileManagementApi.createSample(formData);
      }

      setState({
        notice: uploadMode === "folder" ? "Samples uploaded." : "Sample uploaded.",
        error: "",
      });
      clearUploadInputs();
      await refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submitFileManagement() {
    const visibleSampleIds = visibleFileManagementSampleIds();
    const selectedSampleIds = stateRef.current.fileManagementSelection.length
      ? stateRef.current.fileManagementSelection
      : visibleSampleIds;

    try {
      if (stateRef.current.fileManagementMode === "create-sample-set") {
        const sampleSetName = stateRef.current.fileManagementDraft.sample_set_name.trim();
        const sampleSetType = stateRef.current.fileManagementDraft.sample_set_type.trim();
        if (!sampleSetName) {
          setState({ error: "Sample set name is required." });
          return;
        }
        if (!sampleSetType) {
          setState({ error: "Sample set type is required." });
          return;
        }

        await fileManagementApi.createSampleSet({
          name: sampleSetName,
          type: sampleSetType,
          description: stateRef.current.fileManagementDraft.sample_set_description.trim() || null,
          sample_ids: selectedSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...stateRef.current.fileManagementDraft,
            sample_set_name: "",
            sample_set_type: "",
            sample_set_description: "",
          },
          notice: `Sample set ${sampleSetName} saved.`,
          error: "",
        });
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
      } else if (stateRef.current.fileManagementMode === "assign-grouping-value") {
        const groupingName = (stateRef.current.fileManagementDraft.grouping_value_group_name || stateRef.current.groupings[0]?.name || "").trim();
        const valueName = stateRef.current.fileManagementDraft.grouping_value_name.trim();
        if (!groupingName) {
          setState({ error: "Grouping is required." });
          return;
        }
        if (!valueName) {
          setState({ error: "Value name is required." });
          return;
        }

        await fileManagementApi.createGroupingValue(groupingName, {
          value: valueName,
          sample_ids: selectedSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...stateRef.current.fileManagementDraft,
            grouping_value_name: "",
          },
          notice: `Value ${valueName} saved for ${groupingName}.`,
          error: "",
        });
      } else if (stateRef.current.fileManagementMode === "delete-samples") {
        if (!selectedSampleIds.length) {
          setState({ error: "Select at least one sample to delete." });
          return;
        }
        if (!window.confirm(`Delete ${selectedSampleIds.length} sample(s)? This cannot be undone.`)) return;

        for (const sampleId of selectedSampleIds) {
          await fileManagementApi.deleteSample(sampleId);
        }
        setState({
          fileManagementSelection: [],
          notice: `${selectedSampleIds.length} sample(s) deleted.`,
          error: "",
        });
        await refresh();
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        return;
      } else {
        const groupingName = stateRef.current.fileManagementDraft.grouping_name.trim();
        if (!groupingName) {
          setState({ error: "Grouping name is required." });
          return;
        }

        await fileManagementApi.createGrouping({
          name: groupingName,
          sample_ids: selectedSampleIds,
        });
        setState({
          fileManagementDraft: {
            ...stateRef.current.fileManagementDraft,
            grouping_name: "",
          },
          notice: `Grouping ${groupingName} saved.`,
          error: "",
        });
      }

      await refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }


  useEffect(() => {
    void loadFileManagementData();
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("file-management-page", [
      { kind: "error", message: stateRef.current.error },
      { kind: "success", message: stateRef.current.notice },
    ]);
  }, [syncNotifications, stateRef.current.error, stateRef.current.notice]);

  return {
    state: stateRef.current,
    uploadRefs: {
      sampleId: uploadSampleIdRef,
      file: uploadFileRef,
      groundTruth: uploadGroundTruthRef,
      imageFolder: uploadImageFolderRef,
      groundTruthFolder: uploadGroundTruthFolderRef,
    },
    actions: {
      refresh,
      setUploadMode,
      closeSampleDetail,
      openSample,
      deleteSample,
      applyFileManagementFilter,
      setFileManagementMode,
      selectAllFileManagement,
      setFileManagementQuery,
      setFileManagementQueryMode,
      setFileManagementGroupFilter,
      setFileManagementGroupFilterValue,
      setFileManagementDraftField,
      toggleFileManagementSelection,
      submitUpload,
      submitFileManagement,
    },
  };
}
