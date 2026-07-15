"use client";

import { useState } from "react";

import { fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import {
  DEFAULT_DRAFTS,
  DEFAULT_SELECTIONS,
  buildSelectionSet,
  cloneSelections,
  normalizeManagementAction,
  normalizeManagementType,
  objectTypeLabel,
  recordIdToString,
} from "./fileManagementShared.js";

function createInitialDrafts() {
  return { ...DEFAULT_DRAFTS };
}

async function performDeleteRecord(type, recordId) {
  const normalizedId = recordIdToString(recordId);
  if (type === "artifact") {
    await fileManagementApi.deleteArtifact(normalizedId);
    return;
  }
  if (type === "asset") {
    await fileManagementApi.deleteAsset(normalizedId);
    return;
  }
  await fileManagementApi.deleteSample(normalizedId);
}

async function performDeleteRecords(type, recordIds) {
  if (!recordIds.length) return;

  if (type === "artifact") {
    await fileManagementApi.deleteArtifacts(
      recordIds
        .map((recordId) => Number(recordId))
        .filter((recordId) => Number.isFinite(recordId)),
    );
    return;
  }

  if (type === "asset") {
    await fileManagementApi.deleteAssets(
      recordIds
        .map((recordId) => Number(recordId))
        .filter((recordId) => Number.isFinite(recordId)),
    );
    return;
  }

  await fileManagementApi.deleteSamples(recordIds.map((recordId) => recordIdToString(recordId)));
}

export function useFileSelectionActions() {
  const [selections, setSelections] = useState(() => cloneSelections(DEFAULT_SELECTIONS));
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [managementModalOpen, setManagementModalOpen] = useState(false);

  function setDraftField(field, value) {
    setDrafts((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSelection(type, recordId, shouldInclude) {
    const normalizedId = recordIdToString(recordId);
    setSelections((current) => {
      const selection = current[type] || [];
      const index = selection.indexOf(normalizedId);
      if (shouldInclude && index === -1) {
        return {
          ...current,
          [type]: [...selection, normalizedId],
        };
      }
      if (!shouldInclude && index !== -1) {
        return {
          ...current,
          [type]: selection.filter((value) => value !== normalizedId),
        };
      }
      return current;
    });
  }

  function selectAllVisible(type, visibleRecords, recordIdForType) {
    setSelections((current) => ({
      ...current,
      [type]: visibleRecords.map((record) => recordIdForType(type, record)),
    }));
  }

  function clearSelection(type) {
    setSelections((current) => ({
      ...current,
      [type]: [],
    }));
  }

  function openManagementModal() {
    setManagementModalOpen(true);
  }

  function closeManagementModal() {
    setManagementModalOpen(false);
  }

  async function deleteRecord(type, recordId, effects) {
    const normalizedType = normalizeManagementType(type);
    const normalizedId = recordIdToString(recordId);
    const label = `${objectTypeLabel(normalizedType).slice(0, -1).toLowerCase()} ${normalizedId}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      await performDeleteRecord(normalizedType, normalizedId);
      clearSelection(normalizedType);
      effects.closeDetailIfMatching(normalizedType);
      effects.setNotice(`Deleted ${label}.`);
      effects.setError("");
      await effects.refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (error) {
      effects.setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function submitManagement(context) {
    const {
      type,
      action,
      visibleIds,
      effects,
    } = context;
    const normalizedType = normalizeManagementType(type);
    const normalizedAction = normalizeManagementAction(normalizedType, action);
    const explicitSelection = [...(selections[normalizedType] || [])];

    try {
      if (normalizedType === "sample" && normalizedAction === "create-sample-set") {
        const sampleSetName = drafts.sample_set_name.trim();
        if (!sampleSetName) {
          effects.setError("Sample set name is required.");
          return;
        }
        const selectedIds = explicitSelection.length ? explicitSelection : visibleIds;
        if (!selectedIds.length) {
          effects.setError("Select at least one sample or make sure the filter returns results.");
          return;
        }

        await fileManagementApi.createSampleSet({
          name: sampleSetName,
          description: drafts.sample_set_description.trim() || null,
          sample_ids: buildSelectionSet(selectedIds),
          type: "manual",
        });
        setDrafts((current) => ({
          ...current,
          sample_set_name: "",
          sample_set_description: "",
        }));
        clearSelection("sample");
        setManagementModalOpen(false);
        effects.setNotice(`Sample set ${sampleSetName} saved.`);
        effects.setError("");
        await effects.refresh();
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        return;
      }

      if (normalizedType === "artifact" && normalizedAction === "create-artifact-group") {
        const artifactGroupName = drafts.artifact_group_name.trim();
        if (!artifactGroupName) {
          effects.setError("Artifact group name is required.");
          return;
        }
        const selectedIds = explicitSelection.length ? explicitSelection : visibleIds;
        if (!selectedIds.length) {
          effects.setError("Select at least one artifact or make sure the filter returns results.");
          return;
        }

        await fileManagementApi.createArtifactGroup({
          name: artifactGroupName,
          description: drafts.artifact_group_description.trim() || null,
          artifact_ids: selectedIds.map((artifactId) => Number(artifactId)).filter((artifactId) => Number.isFinite(artifactId)),
          matching_type: "manual",
          matching_rule: {},
          mapping_type: "one-to-one",
        });
        setDrafts((current) => ({
          ...current,
          artifact_group_name: "",
          artifact_group_description: "",
        }));
        clearSelection("artifact");
        setManagementModalOpen(false);
        effects.setNotice(`Artifact group ${artifactGroupName} saved.`);
        effects.setError("");
        await effects.refresh();
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        return;
      }

      if (!explicitSelection.length) {
        effects.setError(`Select at least one ${objectTypeLabel(normalizedType).toLowerCase().slice(0, -1)} to delete.`);
        return;
      }
      if (!window.confirm(`Delete ${explicitSelection.length} ${objectTypeLabel(normalizedType).toLowerCase()}? This cannot be undone.`)) return;

      await performDeleteRecords(normalizedType, explicitSelection);

      effects.closeDetailIfMatching(normalizedType);
      clearSelection(normalizedType);
      setManagementModalOpen(false);
      effects.setNotice(`${explicitSelection.length} ${objectTypeLabel(normalizedType).toLowerCase()} deleted.`);
      effects.setError("");
      await effects.refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (error) {
      effects.setError(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    state: {
      selections,
      drafts,
      managementModalOpen,
    },
    actions: {
      setDraftField,
      toggleSelection,
      selectAllVisible,
      clearSelection,
      openManagementModal,
      closeManagementModal,
      deleteRecord,
      submitManagement,
    },
  };
}
