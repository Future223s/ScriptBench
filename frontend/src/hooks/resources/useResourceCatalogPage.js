"use client";

import { useEffect, useMemo, useState } from "react";

import {
  extractArtifactGroupItems,
  extractOutputSpecItems,
  extractPayloadTemplateItems,
  extractWorkflowStepItems,
  resourceCatalogApi,
} from "../../api/endpoints/resourceCatalog.ts";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";
import {
  DEFAULT_RESOURCE_FILTERS,
  buildResourceCatalog,
  cloneResourceFilters,
  normalizeResourceType,
  visibleResourceRows,
} from "./resourceCatalogShared.js";

function createCatalogState() {
  return {
    artifactGroups: [],
    payloadTemplates: [],
    workflowSteps: [],
    outputSpecs: [],
  };
}

function createArtifactGroupDraftState() {
  return {
    groupName: "",
    description: "",
    mappingType: "one-to-many",
    ordering: "alphabetical",
    membershipArtifactField: "artifact_name",
    membershipOperator: "contains",
    membershipPattern: "",
    membershipCaseSensitive: false,
    sampleMappingArtifactField: "artifact_name",
    sampleMappingSampleField: "sample_name",
    sampleMappingOperator: "contains",
    sampleMappingCaseSensitive: false,
  };
}

function buildArtifactGroupDetail(record) {
  return {
    title: record.artifact_group_name || `Artifact group ${record.artifact_group_id}`,
    typeLabel: "Artifact group",
    metadata: [
      ["ID", record.artifact_group_id],
      ["Status", record.status || "draft"],
      ["Mapping type", record.mapping_type || "one-to-one"],
      ["Created", record.created_at || ""],
      ["Membership mapping ID", record.membership_mapping_id || ""],
      ["Sample mapping ID", record.sample_mapping_id || ""],
    ].filter(([, value]) => value !== ""),
    sections: [
      {
        title: "Description",
        content: record.artifact_group_description || "No description provided.",
      },
      {
        title: "Position rule",
        content: JSON.stringify(record.position_rule || {}, null, 2),
      },
    ],
    raw: record,
  };
}

export function useResourceCatalogPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resourceType, setResourceTypeState] = useState("artifact-group");
  const [filters, setFilters] = useState(() => cloneResourceFilters(DEFAULT_RESOURCE_FILTERS));
  const [appliedFilters, setAppliedFilters] = useState(() => cloneResourceFilters(DEFAULT_RESOURCE_FILTERS));
  const [catalogs, setCatalogs] = useState(createCatalogState);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedArtifactGroupIds, setSelectedArtifactGroupIds] = useState([]);
  const [createArtifactGroupOpen, setCreateArtifactGroupOpen] = useState(false);
  const [createArtifactGroupStep, setCreateArtifactGroupStep] = useState(1);
  const [createArtifactGroupDraft, setCreateArtifactGroupDraft] = useState(createArtifactGroupDraftState);
  const [createArtifactGroupLoading, setCreateArtifactGroupLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");

    const [artifactGroupsResult, payloadTemplatesResult, workflowStepsResult, outputSpecsResult] = await Promise.allSettled([
      resourceCatalogApi.getArtifactGroups(),
      resourceCatalogApi.getPayloadTemplates(),
      resourceCatalogApi.getWorkflowSteps(),
      resourceCatalogApi.getOutputSpecs(),
    ]);

    const failures = [];
    if (artifactGroupsResult.status === "rejected") failures.push(artifactGroupsResult.reason);
    if (payloadTemplatesResult.status === "rejected") failures.push(payloadTemplatesResult.reason);
    if (workflowStepsResult.status === "rejected") failures.push(workflowStepsResult.reason);
    if (outputSpecsResult.status === "rejected") failures.push(outputSpecsResult.reason);

    setCatalogs({
      artifactGroups: artifactGroupsResult.status === "fulfilled" ? extractArtifactGroupItems(artifactGroupsResult.value) : [],
      payloadTemplates: payloadTemplatesResult.status === "fulfilled" ? extractPayloadTemplateItems(payloadTemplatesResult.value) : [],
      workflowSteps: workflowStepsResult.status === "fulfilled" ? extractWorkflowStepItems(workflowStepsResult.value) : [],
      outputSpecs: outputSpecsResult.status === "fulfilled" ? extractOutputSpecItems(outputSpecsResult.value) : [],
    });
    setLoading(false);
    setError(failures.length ? (failures[0] instanceof Error ? failures[0].message : String(failures[0])) : "");
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("resource-catalog-page", [
      { kind: "error", message: error },
    ]);
  }, [error, syncNotifications]);

  const resourceCatalog = useMemo(() => buildResourceCatalog(catalogs), [catalogs]);
  const visibleRecords = useMemo(
    () => visibleResourceRows(resourceCatalog, appliedFilters, resourceType),
    [resourceCatalog, appliedFilters, resourceType],
  );

  function setResourceType(type) {
    setResourceTypeState(normalizeResourceType(type));
    setDetailOpen(false);
    setDetailType(null);
    setSelectedResource(null);
    setSelectedArtifactGroupIds([]);
    setCreateArtifactGroupOpen(false);
  }

  function setFilterField(type, field, value) {
    const normalizedType = normalizeResourceType(type);
    setFilters((current) => ({
      ...current,
      [normalizedType]: {
        ...current[normalizedType],
        [field]: value,
      },
    }));
  }

  function applyFilters() {
    setAppliedFilters(cloneResourceFilters(filters));
  }

  function clearFilters(type = resourceType) {
    const normalizedType = normalizeResourceType(type);
    const defaults = cloneResourceFilters(DEFAULT_RESOURCE_FILTERS)[normalizedType];
    setFilters((current) => ({
      ...current,
      [normalizedType]: { ...defaults },
    }));
    setAppliedFilters((current) => ({
      ...current,
      [normalizedType]: { ...defaults },
    }));
  }

  function selectAllVisibleArtifactGroups() {
    const ids = visibleRecords
      .filter((row) => row.type === "artifact-group")
      .map((row) => row.id);
    setSelectedArtifactGroupIds(ids);
  }

  function clearArtifactGroupSelection() {
    setSelectedArtifactGroupIds([]);
  }

  function toggleArtifactGroupSelection(recordId, shouldInclude) {
    const normalizedId = String(recordId);
    setSelectedArtifactGroupIds((current) => {
      const selected = current.includes(normalizedId);
      if (shouldInclude && !selected) {
        return [...current, normalizedId];
      }
      if (!shouldInclude && selected) {
        return current.filter((id) => id !== normalizedId);
      }
      return current;
    });
  }

  async function deleteSelectedArtifactGroups() {
    if (!selectedArtifactGroupIds.length) return;

    try {
      setError("");
      await resourceCatalogApi.deleteArtifactGroups({
        artifact_group_ids: selectedArtifactGroupIds,
      });
      setSelectedArtifactGroupIds([]);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }

  async function openResourceDetail(type, recordId) {
    const normalizedType = normalizeResourceType(type);
    const row = (resourceCatalog[normalizedType] || []).find((item) => item.id === String(recordId));
    if (!row) return;

    if (normalizedType !== "artifact-group") {
      setSelectedResource(row.detail);
      setDetailType(normalizedType);
      setDetailOpen(true);
      return;
    }

    try {
      const response = await resourceCatalogApi.getArtifactGroup(recordId);
      const record = response?.data || response;
      if (!record) return;
      setSelectedResource(buildArtifactGroupDetail(record));
      setDetailType(normalizedType);
      setDetailOpen(true);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : String(detailError));
    }
  }

  function closeResourceDetail() {
    setDetailOpen(false);
    setDetailType(null);
    setSelectedResource(null);
  }

  function openCreateArtifactGroup() {
    setError("");
    setCreateArtifactGroupStep(1);
    setCreateArtifactGroupOpen(true);
  }

  function closeCreateArtifactGroup() {
    if (createArtifactGroupLoading) return;
    setCreateArtifactGroupOpen(false);
    setCreateArtifactGroupStep(1);
    setCreateArtifactGroupDraft(createArtifactGroupDraftState());
  }

  function setCreateArtifactGroupField(field, value) {
    setCreateArtifactGroupDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function nextCreateArtifactGroupStep() {
    if (createArtifactGroupStep === 1) {
      if (!createArtifactGroupDraft.groupName.trim()) {
        setError("Artifact group name is required.");
        return;
      }
    }
    if (createArtifactGroupStep === 2) {
      if (!createArtifactGroupDraft.membershipPattern.trim()) {
        setError("Membership pattern is required.");
        return;
      }
    }
    setError("");
    setCreateArtifactGroupStep((current) => Math.min(4, current + 1));
  }

  function previousCreateArtifactGroupStep() {
    setError("");
    setCreateArtifactGroupStep((current) => Math.max(1, current - 1));
  }

  async function submitCreateArtifactGroup() {
    if (!createArtifactGroupDraft.groupName.trim()) {
      setError("Artifact group name is required.");
      return;
    }
    if (!createArtifactGroupDraft.membershipPattern.trim()) {
      setError("Membership pattern is required.");
      return;
    }

    try {
      setCreateArtifactGroupLoading(true);
      setError("");
      await resourceCatalogApi.createArtifactGroup({
        artifact_group_name: createArtifactGroupDraft.groupName.trim(),
        artifact_group_description: createArtifactGroupDraft.description.trim() || null,
        mapping_type: createArtifactGroupDraft.mappingType,
        position_rule: {
          strategy: createArtifactGroupDraft.ordering,
          membership_pattern: createArtifactGroupDraft.membershipPattern.trim(),
          membership_artifact_field: createArtifactGroupDraft.membershipArtifactField,
          membership_operator: createArtifactGroupDraft.membershipOperator,
          membership_case_sensitive: createArtifactGroupDraft.membershipCaseSensitive,
          sample_mapping_artifact_field: createArtifactGroupDraft.sampleMappingArtifactField,
          sample_mapping_sample_field: createArtifactGroupDraft.sampleMappingSampleField,
          sample_mapping_operator: createArtifactGroupDraft.sampleMappingOperator,
          sample_mapping_case_sensitive: createArtifactGroupDraft.sampleMappingCaseSensitive,
        },
      });
      await refresh();
      closeCreateArtifactGroup();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setCreateArtifactGroupLoading(false);
    }
  }

  return {
    state: {
      loading,
      error,
      resourceType,
      filters,
      appliedFilters,
      visibleRecords,
      detailOpen,
      detailType,
      selectedResource,
      selectedArtifactGroupIds,
      createArtifactGroupOpen,
      createArtifactGroupStep,
      createArtifactGroupDraft,
      createArtifactGroupLoading,
      ...catalogs,
    },
    actions: {
      refresh,
      setResourceType,
      setFilterField,
      applyFilters,
      clearFilters,
      selectAllVisibleArtifactGroups,
      clearArtifactGroupSelection,
      toggleArtifactGroupSelection,
      deleteSelectedArtifactGroups,
      openResourceDetail,
      closeResourceDetail,
      openCreateArtifactGroup,
      closeCreateArtifactGroup,
      setCreateArtifactGroupField,
      nextCreateArtifactGroupStep,
      previousCreateArtifactGroupStep,
      submitCreateArtifactGroup,
    },
  };
}
