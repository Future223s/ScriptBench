"use client";

import { useEffect, useMemo, useState } from "react";

import {
  extractArtifactGroupItems,
  extractOutputSpecItems,
  extractPayloadTemplateItems,
  extractSourceItems,
  extractSampleSetItems,
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
import { useSampleSetCreation } from "./useSampleSetCreation.js";

function createCatalogState() {
  return {
    artifactGroups: [],
    sampleSets: [],
    payloadTemplates: [],
    workflowSteps: [],
    outputSpecs: [],
    assets: [],
    samples: [],
    artifacts: [],
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

function createPayloadTemplateDraftState() {
  return {
    name: "",
    description: "",
    modelFamily: "",
    promptJson: JSON.stringify({ contents: [{ role: "user", parts: [] }] }, null, 2),
    resources: [],
    // Retained temporarily for the legacy editor below; new templates do not use it.
    rootTemplate: "{}",
    messages: [],
    inputs: [],
    selectedMessageIndex: null,
  };
}

const TABLE_SOURCE_FIELDS = {
  artifacts: [
    "artifact_id",
    "artifact_name",
    "originating_sample_id",
    "artifact_group_id",
    "artifact_category",
    "artifact_blob",
    "artifact_mime_type",
  ],
  samples: [
    "sample_id",
    "sample_name",
    "sample_blob",
    "sample_mime_type",
    "ground_truth_text",
  ],
  model_outputs: [
    "model_output_id",
    "workflow_step_id",
    "sample_id",
    "parsed_output",
    "raw_model_response",
    "parse_status",
    "time_elapsed",
    "completed_at",
  ],
};

function createTableSourceConfig() {
  return {
    table: "artifacts",
    match_field: "originating_sample_id",
    order_by: "artifact_id",
    fields: [],
  };
}

function createOutputSpecDraftState() {
  return {
    name: "",
    type: "json",
    instructions: "",
    schemaMode: "fields",
    fields: [],
    itemSchema: "{}",
  };
}

function createWorkflowStepDraftState() {
  return {
    stepName: "",
    modelFamily: "",
    model: "",
    payloadTemplateId: "",
    outputSpecId: "",
  };
}

function parseOptionalInteger(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildArtifactGroupDetail(record) {
  return {
    title:
      record.artifact_group_name ||
      `Artifact group ${record.artifact_group_id}`,
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
        content:
          record.artifact_group_description || "No description provided.",
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
  const [resourceType, setResourceTypeState] = useState("workflow-step");
  const [filters, setFilters] = useState(() =>
    cloneResourceFilters(DEFAULT_RESOURCE_FILTERS),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    cloneResourceFilters(DEFAULT_RESOURCE_FILTERS),
  );
  const [catalogs, setCatalogs] = useState(createCatalogState);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedArtifactGroupIds, setSelectedArtifactGroupIds] = useState([]);
  const [selectedPayloadTemplateIds, setSelectedPayloadTemplateIds] = useState(
    [],
  );
  const [createArtifactGroupOpen, setCreateArtifactGroupOpen] = useState(false);
  const [createArtifactGroupStep, setCreateArtifactGroupStep] = useState(1);
  const [createArtifactGroupDraft, setCreateArtifactGroupDraft] = useState(
    createArtifactGroupDraftState,
  );
  const [createArtifactGroupLoading, setCreateArtifactGroupLoading] =
    useState(false);
  const [createPayloadTemplateOpen, setCreatePayloadTemplateOpen] =
    useState(false);
  const [createPayloadTemplateDraft, setCreatePayloadTemplateDraft] = useState(
    createPayloadTemplateDraftState,
  );
  const [createPayloadTemplateLoading, setCreatePayloadTemplateLoading] =
    useState(false);
  const [createPayloadTemplateStep, setCreatePayloadTemplateStep] = useState(1);
  const [createOutputSpecOpen, setCreateOutputSpecOpen] = useState(false);
  const [createOutputSpecDraft, setCreateOutputSpecDraft] = useState(
    createOutputSpecDraftState,
  );
  const [createOutputSpecLoading, setCreateOutputSpecLoading] = useState(false);
  const [createWorkflowStepOpen, setCreateWorkflowStepOpen] = useState(false);
  const [createWorkflowStepStep, setCreateWorkflowStepStep] = useState(1);
  const [createWorkflowStepDraft, setCreateWorkflowStepDraft] = useState(
    createWorkflowStepDraftState,
  );
  const [createWorkflowStepLoading, setCreateWorkflowStepLoading] =
    useState(false);

  async function refresh() {
    setLoading(true);
    setError("");

    const [
      artifactGroupsResult,
      sampleSetsResult,
      payloadTemplatesResult,
      workflowStepsResult,
      outputSpecsResult,
      assetsResult,
      samplesResult,
      artifactsResult,
    ] = await Promise.allSettled([
      resourceCatalogApi.getArtifactGroups(),
      resourceCatalogApi.getSampleSets(),
      resourceCatalogApi.getPayloadTemplates(),
      resourceCatalogApi.getWorkflowSteps(),
      resourceCatalogApi.getOutputSpecs(),
      resourceCatalogApi.getAssets(),
      resourceCatalogApi.getSamples(),
      resourceCatalogApi.getArtifacts(),
    ]);

    const failures = [];
    if (artifactGroupsResult.status === "rejected")
      failures.push(artifactGroupsResult.reason);
    if (sampleSetsResult.status === "rejected")
      failures.push(sampleSetsResult.reason);
    if (payloadTemplatesResult.status === "rejected")
      failures.push(payloadTemplatesResult.reason);
    if (workflowStepsResult.status === "rejected")
      failures.push(workflowStepsResult.reason);
    if (outputSpecsResult.status === "rejected")
      failures.push(outputSpecsResult.reason);
    if (assetsResult.status === "rejected") failures.push(assetsResult.reason);
    if (samplesResult.status === "rejected")
      failures.push(samplesResult.reason);
    if (artifactsResult.status === "rejected")
      failures.push(artifactsResult.reason);

    setCatalogs({
      artifactGroups:
        artifactGroupsResult.status === "fulfilled"
          ? extractArtifactGroupItems(artifactGroupsResult.value)
          : [],
      sampleSets:
        sampleSetsResult.status === "fulfilled"
          ? extractSampleSetItems(sampleSetsResult.value)
          : [],
      payloadTemplates:
        payloadTemplatesResult.status === "fulfilled"
          ? extractPayloadTemplateItems(payloadTemplatesResult.value)
          : [],
      workflowSteps:
        workflowStepsResult.status === "fulfilled"
          ? extractWorkflowStepItems(workflowStepsResult.value)
          : [],
      outputSpecs:
        outputSpecsResult.status === "fulfilled"
          ? extractOutputSpecItems(outputSpecsResult.value)
          : [],
      assets:
        assetsResult.status === "fulfilled"
          ? extractSourceItems(assetsResult.value)
          : [],
      samples:
        samplesResult.status === "fulfilled"
          ? extractSourceItems(samplesResult.value)
          : [],
      artifacts:
        artifactsResult.status === "fulfilled"
          ? extractSourceItems(artifactsResult.value)
          : [],
    });
    setLoading(false);
    setError(
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
    if (!syncNotifications) return undefined;

    syncNotifications("resource-catalog-page", [
      { kind: "error", message: error },
    ]);
  }, [error, syncNotifications]);

  const resourceCatalog = useMemo(
    () => buildResourceCatalog(catalogs),
    [catalogs],
  );
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
    setSelectedPayloadTemplateIds([]);
    setCreateArtifactGroupOpen(false);
    sampleSetCreation.actions.closeCreateSampleSet();
    setCreatePayloadTemplateOpen(false);
    setCreateOutputSpecOpen(false);
    setCreateWorkflowStepOpen(false);
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedFilters(cloneResourceFilters(filters));
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  function applyFilters() {
    setAppliedFilters(cloneResourceFilters(filters));
  }

  function clearFilters(type = resourceType) {
    const normalizedType = normalizeResourceType(type);
    const defaults = cloneResourceFilters(DEFAULT_RESOURCE_FILTERS)[
      normalizedType
    ];
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

  function selectAllVisiblePayloadTemplates() {
    setSelectedPayloadTemplateIds(
      visibleRecords
        .filter((row) => row.type === "payload-template")
        .map((row) => row.id),
    );
  }

  function clearPayloadTemplateSelection() {
    setSelectedPayloadTemplateIds([]);
  }

  function togglePayloadTemplateSelection(recordId, shouldInclude) {
    const normalizedId = String(recordId);
    setSelectedPayloadTemplateIds((current) => {
      const selected = current.includes(normalizedId);
      if (shouldInclude && !selected) return [...current, normalizedId];
      if (!shouldInclude && selected)
        return current.filter((id) => id !== normalizedId);
      return current;
    });
  }

  function toggleResourceSelection(type, recordId, shouldInclude) {
    if (type === "payload-template") {
      togglePayloadTemplateSelection(recordId, shouldInclude);
      return;
    }
    toggleArtifactGroupSelection(recordId, shouldInclude);
  }

  function selectAllVisibleResources() {
    if (resourceType === "payload-template") {
      selectAllVisiblePayloadTemplates();
      return;
    }
    selectAllVisibleArtifactGroups();
  }

  function clearResourceSelection() {
    if (resourceType === "payload-template") {
      clearPayloadTemplateSelection();
      return;
    }
    clearArtifactGroupSelection();
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
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  }

  async function deleteSelectedPayloadTemplates() {
    if (!selectedPayloadTemplateIds.length) return;
    try {
      setError("");
      await resourceCatalogApi.deletePayloadTemplates({
        payload_template_ids: selectedPayloadTemplateIds.map(Number),
      });
      setSelectedPayloadTemplateIds([]);
      await refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  }

  async function deleteWorkflowStep(workflowStepId) {
    if (!window.confirm("Delete this workflow step? This cannot be undone."))
      return;
    try {
      setError("");
      await resourceCatalogApi.deleteWorkflowStep(workflowStepId);
      await refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  }

  async function openResourceDetail(type, recordId) {
    const normalizedType = normalizeResourceType(type);
    const row = (resourceCatalog[normalizedType] || []).find(
      (item) => item.id === String(recordId),
    );
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
      setError(
        detailError instanceof Error
          ? detailError.message
          : String(detailError),
      );
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

  const sampleSetCreation = useSampleSetCreation({
    samples: catalogs.samples,
    sampleSets: catalogs.sampleSets,
    onCreated: refresh,
    setError,
  });

  function openCreatePayloadTemplate() {
    setError("");
    setCreatePayloadTemplateStep(1);
    setCreatePayloadTemplateDraft(createPayloadTemplateDraftState());
    setCreatePayloadTemplateOpen(true);
  }
  function openCreateOutputSpec() {
    setError("");
    setCreateOutputSpecDraft(createOutputSpecDraftState());
    setCreateOutputSpecOpen(true);
  }
  function closeCreateOutputSpec() {
    if (!createOutputSpecLoading) setCreateOutputSpecOpen(false);
  }
  function updateCreateOutputSpecField(field, value) {
    setCreateOutputSpecDraft((current) => ({ ...current, [field]: value }));
  }
  function addOutputSpecField() {
    setCreateOutputSpecDraft((current) => ({
      ...current,
      fields: [...current.fields, { name: "", description: "" }],
    }));
  }
  function updateOutputSpecField(index, field, value) {
    setCreateOutputSpecDraft((current) => ({
      ...current,
      fields: current.fields.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }
  function removeOutputSpecField(index) {
    setCreateOutputSpecDraft((current) => ({
      ...current,
      fields: current.fields.filter((_, itemIndex) => itemIndex !== index),
    }));
  }
  async function submitCreateOutputSpec() {
    if (!createOutputSpecDraft.name.trim()) {
      setError("Output specification name is required.");
      return;
    }
    try {
      setCreateOutputSpecLoading(true);
      setError("");
      const itemSchema =
        createOutputSpecDraft.schemaMode === "fields"
          ? { fields: createOutputSpecDraft.fields }
          : JSON.parse(createOutputSpecDraft.itemSchema || "{}");
      await resourceCatalogApi.createOutputSpec({
        output_spec_name: createOutputSpecDraft.name.trim(),
        type: createOutputSpecDraft.type,
        instructions: createOutputSpecDraft.instructions.trim() || null,
        item_schema: itemSchema,
      });
      await refresh();
      closeCreateOutputSpec();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
    } finally {
      setCreateOutputSpecLoading(false);
    }
  }
  function openCreateWorkflowStep() {
    setError("");
    setCreateWorkflowStepStep(1);
    setCreateWorkflowStepDraft(createWorkflowStepDraftState());
    setCreateWorkflowStepOpen(true);
  }
  function closeCreateWorkflowStep() {
    if (!createWorkflowStepLoading) setCreateWorkflowStepOpen(false);
  }
  function updateCreateWorkflowStepField(field, value) {
    setCreateWorkflowStepDraft((current) => ({ ...current, [field]: value }));
  }
  function nextCreateWorkflowStep() {
    if (
      !createWorkflowStepDraft.stepName.trim() ||
      !createWorkflowStepDraft.model.trim() ||
      !createWorkflowStepDraft.modelFamily.trim()
    ) {
      setError("Step name, model family, and model are required.");
      return;
    }
    setError("");
    setCreateWorkflowStepStep((current) => Math.min(3, current + 1));
  }
  function previousCreateWorkflowStep() {
    setError("");
    setCreateWorkflowStepStep((current) => Math.max(1, current - 1));
  }
  async function submitCreateWorkflowStep() {
    if (
      !createWorkflowStepDraft.payloadTemplateId ||
      !createWorkflowStepDraft.outputSpecId
    ) {
      setError("Select a payload template and output specification.");
      return;
    }
    try {
      setCreateWorkflowStepLoading(true);
      setError("");
      await resourceCatalogApi.createWorkflowStep({
        step_name: createWorkflowStepDraft.stepName.trim(),
        model_family: createWorkflowStepDraft.modelFamily.trim(),
        model: createWorkflowStepDraft.model.trim(),
        payload_template_id: Number(createWorkflowStepDraft.payloadTemplateId),
        output_spec_id: Number(createWorkflowStepDraft.outputSpecId),
      });
      await refresh();
      closeCreateWorkflowStep();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
    } finally {
      setCreateWorkflowStepLoading(false);
    }
  }
  function closeCreatePayloadTemplate() {
    if (!createPayloadTemplateLoading) setCreatePayloadTemplateOpen(false);
  }
  function nextCreatePayloadTemplateStep() {
    if (
      createPayloadTemplateStep === 1 &&
      (!createPayloadTemplateDraft.name.trim() ||
        !createPayloadTemplateDraft.modelFamily.trim())
    )
      return setError("Template name and model family are required.");
    setError("");
    setCreatePayloadTemplateStep((current) => Math.min(3, current + 1));
  }
  function previousCreatePayloadTemplateStep() {
    setError("");
    setCreatePayloadTemplateStep((current) => Math.max(1, current - 1));
  }
  function updatePayloadDraft(field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }
  function addPayloadResource() {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: [
        ...current.resources,
        {
          name: "",
          table: "",
          conditions: [],
          cardinality: "many",
          batchLimit: 1,
        },
      ],
    }));
  }
  function updatePayloadResource(index, field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: current.resources.map((resource, resourceIndex) =>
        resourceIndex === index ? { ...resource, [field]: value } : resource,
      ),
    }));
  }
  function updatePayloadResourceCondition(
    resourceIndex,
    conditionIndex,
    field,
    value,
  ) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: current.resources.map((resource, index) =>
        index === resourceIndex
          ? {
              ...resource,
              conditions: resource.conditions.map((condition, itemIndex) =>
                itemIndex === conditionIndex
                  ? { ...condition, [field]: value }
                  : condition,
              ),
            }
          : resource,
      ),
    }));
  }
  function addPayloadResourceCondition(index) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: current.resources.map((resource, resourceIndex) =>
        resourceIndex === index
          ? {
              ...resource,
              conditions: [
                ...resource.conditions,
                {
                  field: "",
                  operator: "equals",
                  valueType: "manual",
                  value: "",
                },
              ],
            }
          : resource,
      ),
    }));
  }
  function removePayloadResourceCondition(resourceIndex, conditionIndex) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: current.resources.map((resource, index) =>
        index === resourceIndex
          ? {
              ...resource,
              conditions: resource.conditions.filter(
                (_, itemIndex) => itemIndex !== conditionIndex,
              ),
            }
          : resource,
      ),
    }));
  }
  function removePayloadResource(index) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      resources: current.resources.filter(
        (_, resourceIndex) => resourceIndex !== index,
      ),
    }));
  }
  function addPayloadMessage() {
    setCreatePayloadTemplateDraft((current) => {
      const messages = [
        ...current.messages,
        {
          client_id: `message-${Date.now()}`,
          role: "user",
          label: "",
          message_template: '{"content": []}',
        },
      ];
      return {
        ...current,
        messages,
        selectedMessageIndex: messages.length - 1,
      };
    });
  }
  function updatePayloadMessage(index, field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      messages: current.messages.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }
  function togglePayloadMessageSelection(index) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      selectedMessageIndex:
        current.selectedMessageIndex === index ? null : index,
    }));
  }
  function removePayloadMessage(index) {
    setCreatePayloadTemplateDraft((current) => {
      const messages = current.messages.filter(
        (_, itemIndex) => itemIndex !== index,
      );
      const inputs = current.inputs
        .filter((item) => item.messageIndex !== index)
        .map((item) => ({
          ...item,
          messageIndex:
            item.messageIndex > index
              ? item.messageIndex - 1
              : item.messageIndex,
        }));
      return {
        ...current,
        messages,
        inputs,
        selectedMessageIndex: messages.length
          ? Math.min(index, messages.length - 1)
          : null,
      };
    });
  }
  function addPayloadInput() {
    setCreatePayloadTemplateDraft((current) =>
      current.selectedMessageIndex == null
        ? current
        : {
            ...current,
            inputs: [
              ...current.inputs,
              {
                messageIndex: current.selectedMessageIndex,
                inputType: "text",
                bindingMode: "fixed",
                sourceType: null,
                sourceObjectId: "",
                fixedValue: "",
                artifactGroupId: "",
                workflowStepId: "",
                required: true,
                batchLimit: 1,
                sourceConfig: createTableSourceConfig(),
              },
            ],
          },
    );
  }
  function updatePayloadInput(index, field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }
  function removePayloadInput(index) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updatePayloadSourceConfig(index, field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              sourceConfig: {
                ...(item.sourceConfig || createTableSourceConfig()),
                [field]: value,
              },
            }
          : item,
      ),
    }));
  }

  function addPayloadSourceField(index) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              sourceConfig: {
                ...(item.sourceConfig || createTableSourceConfig()),
                fields: [
                  ...(item.sourceConfig?.fields || []),
                  {
                    field:
                      TABLE_SOURCE_FIELDS[
                        item.sourceConfig?.table || "artifacts"
                      ][0],
                    type: "text",
                  },
                ],
              },
            }
          : item,
      ),
    }));
  }

  function updatePayloadSourceField(index, fieldIndex, field, value) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              sourceConfig: {
                ...(item.sourceConfig || createTableSourceConfig()),
                fields: (item.sourceConfig?.fields || []).map(
                  (sourceField, sourceFieldIndex) =>
                    sourceFieldIndex === fieldIndex
                      ? { ...sourceField, [field]: value }
                      : sourceField,
                ),
              },
            }
          : item,
      ),
    }));
  }

  function removePayloadSourceField(index, fieldIndex) {
    setCreatePayloadTemplateDraft((current) => ({
      ...current,
      inputs: current.inputs.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              sourceConfig: {
                ...(item.sourceConfig || createTableSourceConfig()),
                fields: (item.sourceConfig?.fields || []).filter(
                  (_, sourceFieldIndex) => sourceFieldIndex !== fieldIndex,
                ),
              },
            }
          : item,
      ),
    }));
  }
  async function submitCreatePayloadTemplate() {
    const draft = createPayloadTemplateDraft;
    if (!draft.name.trim() || !draft.modelFamily.trim())
      return setError("Template name and model family are required.");
    try {
      setCreatePayloadTemplateLoading(true);
      setError("");
      const prompt = JSON.parse(draft.promptJson || "{}");
      if (!prompt || typeof prompt !== "object" || Array.isArray(prompt))
        throw new Error("Prompt JSON must be an object.");
      const requestPayload = {
        payload_template_name: draft.name.trim(),
        description: draft.description.trim() || null,
        model_family: draft.modelFamily.trim(),
        payload_template: prompt,
        resources: draft.resources.map((resource) => ({
          name: resource.name.trim(),
          table: resource.table,
          batch_limit: Number(resource.batchLimit) || 1,
          conditions: resource.conditions.map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value_type: condition.valueType,
            value: condition.value,
          })),
        })),
      };
      console.log("[PayloadTemplate] create request payload", requestPayload);
      await resourceCatalogApi.createPayloadTemplate(requestPayload);
      await refresh();
      closeCreatePayloadTemplate();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
    } finally {
      setCreatePayloadTemplateLoading(false);
    }
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
        artifact_group_description:
          createArtifactGroupDraft.description.trim() || null,
        mapping_type: createArtifactGroupDraft.mappingType,
        position_rule: {
          strategy: createArtifactGroupDraft.ordering,
          membership_pattern: createArtifactGroupDraft.membershipPattern.trim(),
          membership_artifact_field:
            createArtifactGroupDraft.membershipArtifactField,
          membership_operator: createArtifactGroupDraft.membershipOperator,
          membership_case_sensitive:
            createArtifactGroupDraft.membershipCaseSensitive,
          sample_mapping_artifact_field:
            createArtifactGroupDraft.sampleMappingArtifactField,
          sample_mapping_sample_field:
            createArtifactGroupDraft.sampleMappingSampleField,
          sample_mapping_operator:
            createArtifactGroupDraft.sampleMappingOperator,
          sample_mapping_case_sensitive:
            createArtifactGroupDraft.sampleMappingCaseSensitive,
        },
      });
      await refresh();
      closeCreateArtifactGroup();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
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
      selectedPayloadTemplateIds,
      createArtifactGroupOpen,
      createArtifactGroupStep,
      createArtifactGroupDraft,
      createArtifactGroupLoading,
      createPayloadTemplateOpen,
      createPayloadTemplateDraft,
      createPayloadTemplateLoading,
      createPayloadTemplateStep,
      createOutputSpecOpen,
      createOutputSpecDraft,
      createOutputSpecLoading,
      createWorkflowStepOpen,
      createWorkflowStepStep,
      createWorkflowStepDraft,
      createWorkflowStepLoading,
      ...sampleSetCreation.state,
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
      deleteSelectedPayloadTemplates,
      deleteWorkflowStep,
      toggleResourceSelection,
      selectAllVisibleResources,
      clearResourceSelection,
      openResourceDetail,
      closeResourceDetail,
      openCreateArtifactGroup,
      closeCreateArtifactGroup,
      setCreateArtifactGroupField,
      nextCreateArtifactGroupStep,
      previousCreateArtifactGroupStep,
      submitCreateArtifactGroup,
      ...sampleSetCreation.actions,
      openCreatePayloadTemplate,
      closeCreatePayloadTemplate,
      nextCreatePayloadTemplateStep,
      previousCreatePayloadTemplateStep,
      updatePayloadDraft,
      addPayloadResource,
      updatePayloadResource,
      updatePayloadResourceCondition,
      addPayloadResourceCondition,
      removePayloadResourceCondition,
      removePayloadResource,
      addPayloadMessage,
      updatePayloadMessage,
      togglePayloadMessageSelection,
      removePayloadMessage,
      addPayloadInput,
      updatePayloadInput,
      removePayloadInput,
      updatePayloadSourceConfig,
      addPayloadSourceField,
      updatePayloadSourceField,
      removePayloadSourceField,
      submitCreatePayloadTemplate,
      openCreateOutputSpec,
      closeCreateOutputSpec,
      updateCreateOutputSpecField,
      submitCreateOutputSpec,
      openCreateWorkflowStep,
      closeCreateWorkflowStep,
      updateCreateWorkflowStepField,
      nextCreateWorkflowStep,
      previousCreateWorkflowStep,
      submitCreateWorkflowStep,
      addOutputSpecField,
      updateOutputSpecField,
      removeOutputSpecField,
    },
  };
}
