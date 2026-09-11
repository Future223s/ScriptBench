"use client";

import { useEffect, useMemo, useState } from "react";

import {
  extractDerivativeGroupItems,
  extractOutputSpecItems,
  extractPayloadTemplateItems,
  extractSourceItems,
  extractSampleSetItems,
  extractWorkflowStepItems,
  workflowStepsApi,
} from "../../api/endpoints/workflowSteps.ts";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";
import {
  DEFAULT_WORKFLOW_STEP_FILTERS,
  buildWorkflowSteps,
  cloneWorkflowStepFilters,
  normalizeWorkflowStepType,
  visibleWorkflowStepRows,
} from "./workflowStepsShared.js";
import { useSampleSetCreation } from "./useSampleSetCreation.js";

function createCatalogState() {
  return {
    derivativeGroups: [],
    sampleSets: [],
    payloadTemplates: [],
    stepExecutors: [],
    workflowSteps: [],
    outputSpecs: [],
    assets: [],
    samples: [],
    derivatives: [],
  };
}

function createDerivativeGroupDraftState() {
  return {
    groupName: "",
    description: "",
    mappingType: "one-to-many",
    ordering: "alphabetical",
    membershipDerivativeField: "name",
    membershipOperator: "contains",
    membershipPattern: "",
    membershipCaseSensitive: false,
    membershipConditions: [
      {
        field: "name",
        operator: "contains",
        valueType: "manual",
        value: "",
      },
    ],
    sampleMappingDerivativeField: "name",
    sampleMappingSampleField: "name",
    sampleMappingOperator: "contains",
    sampleMappingCaseSensitive: false,
    sampleMappingConditions: [
      {
        field: "name",
        operator: "contains",
        valueType: "sample-field",
        value: "name",
      },
    ],
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
  derivatives: [
    "id",
    "name",
    "sample_id",
    "derivative_group_id",
    "category",
    "blob",
    "mime_type",
  ],
  samples: [
    "id",
    "name",
    "blob",
    "mime_type",
    "ground_truth_text",
  ],
  step_outputs: [
    "id",
    "workflow_id",
    "workflow_step_id",
    "sample_id",
    "parsed_output",
    "parse_status",
    "parse_error",
    "completed_at",
  ],
};

function createTableSourceConfig() {
  return {
    table: "derivatives",
    match_field: "sample_id",
    order_by: "id",
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
    stepExecutor: "",
    method: "",
    executorConfig: {},
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

function buildDerivativeGroupDetail(record) {
  return {
    title:
      record.name ||
      `Derivative group ${record.id}`,
    typeLabel: "Derivative group",
    metadata: [
      ["ID", record.id],
      ["Status", record.status || "draft"],
      ["Mapping type", record.mapping_type || "one-to-one"],
      ["Created", record.created_at || ""],
    ].filter(([, value]) => value !== ""),
    sections: [
      {
        title: "Description",
        content:
          record.description || "No description provided.",
      },
      {
        title: "Position rule",
        content: JSON.stringify(record.position_rule || {}, null, 2),
      },
    ],
    raw: record,
  };
}

export function useWorkflowStepsPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workflowStepType, setWorkflowStepTypeState] = useState("workflow-step");
  const [filters, setFilters] = useState(() =>
    cloneWorkflowStepFilters(DEFAULT_WORKFLOW_STEP_FILTERS),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    cloneWorkflowStepFilters(DEFAULT_WORKFLOW_STEP_FILTERS),
  );
  const [catalogs, setCatalogs] = useState(createCatalogState);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedDerivativeGroupIds, setSelectedDerivativeGroupIds] = useState([]);
  const [selectedPayloadTemplateIds, setSelectedPayloadTemplateIds] = useState(
    [],
  );
  const [createDerivativeGroupOpen, setCreateDerivativeGroupOpen] = useState(false);
  const [createDerivativeGroupStep, setCreateDerivativeGroupStep] = useState(1);
  const [createDerivativeGroupDraft, setCreateDerivativeGroupDraft] = useState(
    createDerivativeGroupDraftState,
  );
  const [createDerivativeGroupLoading, setCreateDerivativeGroupLoading] =
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
  const [executorDefinition, setExecutorDefinition] = useState(null);
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
      derivativeGroupsResult,
      sampleSetsResult,
      payloadTemplatesResult,
      workflowStepsResult,
      outputSpecsResult,
      assetsResult,
      samplesResult,
      derivativesResult,
      executorsResult,
    ] = await Promise.allSettled([
      workflowStepsApi.getDerivativeGroups(),
      workflowStepsApi.getSampleSets(),
      workflowStepsApi.getPayloadTemplates(),
      workflowStepsApi.getWorkflowSteps(),
      workflowStepsApi.getOutputSpecs(),
      workflowStepsApi.getAssets(),
      workflowStepsApi.getSamples(),
      workflowStepsApi.getDerivatives(),
      workflowStepsApi.getStepExecutors(),
    ]);

    const failures = [];
    if (executorsResult.status === "rejected") failures.push(executorsResult.reason);
    if (derivativeGroupsResult.status === "rejected")
      failures.push(derivativeGroupsResult.reason);
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
    if (derivativesResult.status === "rejected")
      failures.push(derivativesResult.reason);

    setCatalogs({
      stepExecutors: executorsResult.status === "fulfilled" ? executorsResult.value.items : [],
      derivativeGroups:
        derivativeGroupsResult.status === "fulfilled"
          ? extractDerivativeGroupItems(derivativeGroupsResult.value)
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
      derivatives:
        derivativesResult.status === "fulfilled"
          ? extractSourceItems(derivativesResult.value)
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

    syncNotifications("workflow-steps-page", [
      { kind: "error", message: error },
    ]);
  }, [error, syncNotifications]);

  const workflowSteps = useMemo(
    () => buildWorkflowSteps(catalogs),
    [catalogs],
  );
  const visibleRecords = useMemo(
    () => visibleWorkflowStepRows(workflowSteps, appliedFilters, workflowStepType),
    [workflowSteps, appliedFilters, workflowStepType],
  );

  function setWorkflowStepType(type) {
    setWorkflowStepTypeState(normalizeWorkflowStepType(type));
    setDetailOpen(false);
    setDetailType(null);
    setSelectedResource(null);
    setSelectedDerivativeGroupIds([]);
    setSelectedPayloadTemplateIds([]);
    setCreateDerivativeGroupOpen(false);
    sampleSetCreation.actions.closeCreateSampleSet();
    setCreatePayloadTemplateOpen(false);
    setCreateOutputSpecOpen(false);
    setCreateWorkflowStepOpen(false);
  }

  function setFilterField(type, field, value) {
    const normalizedType = normalizeWorkflowStepType(type);
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
      setAppliedFilters(cloneWorkflowStepFilters(filters));
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  function applyFilters() {
    setAppliedFilters(cloneWorkflowStepFilters(filters));
  }

  function clearFilters(type = workflowStepType) {
    const normalizedType = normalizeWorkflowStepType(type);
    const defaults = cloneWorkflowStepFilters(DEFAULT_WORKFLOW_STEP_FILTERS)[
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

  function selectAllVisibleDerivativeGroups() {
    const ids = visibleRecords
      .filter((row) => row.type === "derivative-group")
      .map((row) => row.id);
    setSelectedDerivativeGroupIds(ids);
  }

  function clearDerivativeGroupSelection() {
    setSelectedDerivativeGroupIds([]);
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

  function toggleWorkflowStepSelection(type, recordId, shouldInclude) {
    if (type === "payload-template") {
      togglePayloadTemplateSelection(recordId, shouldInclude);
      return;
    }
    toggleDerivativeGroupSelection(recordId, shouldInclude);
  }

  function selectAllVisibleWorkflowSteps() {
    if (workflowStepType === "payload-template") {
      selectAllVisiblePayloadTemplates();
      return;
    }
    selectAllVisibleDerivativeGroups();
  }

  function clearWorkflowStepSelection() {
    if (workflowStepType === "payload-template") {
      clearPayloadTemplateSelection();
      return;
    }
    clearDerivativeGroupSelection();
  }

  function toggleDerivativeGroupSelection(recordId, shouldInclude) {
    const normalizedId = String(recordId);
    setSelectedDerivativeGroupIds((current) => {
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

  async function deleteSelectedDerivativeGroups() {
    if (!selectedDerivativeGroupIds.length) return;

    try {
      setError("");
      await workflowStepsApi.deleteDerivativeGroups({
        ids: selectedDerivativeGroupIds,
      });
      setSelectedDerivativeGroupIds([]);
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
      await workflowStepsApi.deletePayloadTemplates({
        ids: selectedPayloadTemplateIds.map(Number),
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
      await workflowStepsApi.deleteWorkflowStep(workflowStepId);
      await refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : String(deleteError),
      );
    }
  }

  async function deletePayloadTemplateFromWorkflowStep(templateId) {
    if (!window.confirm("Delete this payload template? This cannot be undone.")) return;
    try {
      setError("");
      await workflowStepsApi.deletePayloadTemplates({
        ids: [Number(templateId)],
      });
      setCreateWorkflowStepDraft((current) =>
        String(current.payloadTemplateId) === String(templateId)
          ? { ...current, payloadTemplateId: "" }
          : current,
      );
      await refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : String(deleteError),
      );
    }
  }

  async function deleteOutputSpecFromWorkflowStep(outputSpecId) {
    if (!window.confirm("Delete this output specification? This cannot be undone.")) return;
    try {
      setError("");
      await workflowStepsApi.deleteOutputSpecs({
        ids: [Number(outputSpecId)],
      });
      setCreateWorkflowStepDraft((current) =>
        String(current.outputSpecId) === String(outputSpecId)
          ? { ...current, outputSpecId: "" }
          : current,
      );
      await refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : String(deleteError),
      );
    }
  }

  async function openWorkflowStepDetail(type, recordId) {
    const normalizedType = normalizeWorkflowStepType(type);
    const row = (workflowSteps[normalizedType] || []).find(
      (item) => item.id === String(recordId),
    );
    if (!row) return;

    if (normalizedType !== "derivative-group") {
      setSelectedResource(row.detail);
      setDetailType(normalizedType);
      setDetailOpen(true);
      return;
    }

    try {
      const response = await workflowStepsApi.getDerivativeGroup(recordId);
      const record = response?.data || response;
      if (!record) return;
      setSelectedResource(buildDerivativeGroupDetail(record));
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

  function closeWorkflowStepDetail() {
    setDetailOpen(false);
    setDetailType(null);
    setSelectedResource(null);
  }

  function openCreateDerivativeGroup() {
    setError("");
    setCreateDerivativeGroupStep(1);
    setCreateDerivativeGroupOpen(true);
  }

  const sampleSetCreation = useSampleSetCreation({
    samples: catalogs.samples,
    sampleSets: catalogs.sampleSets,
    onCreated: refresh,
    setError,
  });

  function openCreatePayloadTemplate(stepExecutor = "") {
    setError("");
    setCreatePayloadTemplateStep(1);
    setCreatePayloadTemplateDraft({
      ...createPayloadTemplateDraftState(),
      modelFamily: stepExecutor,
    });
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
      await workflowStepsApi.createOutputSpec({
        name: createOutputSpecDraft.name.trim(),
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
    setExecutorDefinition(null);
    setCreateWorkflowStepOpen(true);
  }
  function closeCreateWorkflowStep() {
    if (!createWorkflowStepLoading) setCreateWorkflowStepOpen(false);
  }
  function updateCreateWorkflowStepField(field, value) {
    if (field === "stepExecutor") setExecutorDefinition(null);
    setCreateWorkflowStepDraft((current) => field === "stepExecutor"
      ? { ...current, stepExecutor: value, method: "", executorConfig: {}, payloadTemplateId: "" }
      : { ...current, [field]: value });
  }
  function workflowStepError(stage) {
    const draft = createWorkflowStepDraft;
    if (!draft.stepName.trim() || !draft.stepExecutor) return "Step name and executor are required.";
    const executor = executorDefinition;
    if (!catalogs.stepExecutors.some((item) => item.id === draft.stepExecutor)) return "Select an available executor.";
    if (stage >= 2) {
      if (!executor || executor.id !== draft.stepExecutor) return "Load executor configuration first.";
      if (!executor.methods.some((item) => item.name === draft.method)) return "Select an executor method.";
      for (const [key, option] of Object.entries(executor.config_schema.properties)) {
        const value = draft.executorConfig[key];
        if (value == null || String(value).trim() === "") {
          if (executor.config_schema.required?.includes(key)) return `${option.title} is required.`;
          continue;
        }
        const type = option.type || option.anyOf?.find((item) => item.type !== "null")?.type;
        const rules = option.type ? option : option.anyOf.find((item) => item.type !== "null");
        if ((type === "number" || type === "integer") &&
            (!Number.isFinite(Number(value)) || (type === "integer" && !Number.isInteger(Number(value))) ||
             (rules.minimum != null && Number(value) < rules.minimum) ||
             (rules.maximum != null && Number(value) > rules.maximum) ||
             (rules.exclusiveMinimum != null && Number(value) <= rules.exclusiveMinimum))) {
          return `Enter a valid ${option.title.toLowerCase()}.`;
        }
      }
    }
    if (stage >= 3 && !draft.payloadTemplateId) return "Select a payload template.";
    if (stage >= 4 && !draft.outputSpecId) return "Select an output specification.";
    return "";
  }
  async function nextCreateWorkflowStep() {
    const error = workflowStepError(createWorkflowStepStep);
    setError(error);
    if (error) return;
    if (createWorkflowStepStep === 1) {
      setCreateWorkflowStepLoading(true);
      try {
        const { data } = await workflowStepsApi.getStepExecutor(createWorkflowStepDraft.stepExecutor);
        setExecutorDefinition(data);
        const defaults = Object.fromEntries(Object.entries(data.config_schema.properties || {})
          .filter(([, option]) => option.default != null)
          .map(([key, option]) => [key, option.default]));
        setCreateWorkflowStepDraft((current) => ({ ...current,
          executorConfig: { ...defaults, ...current.executorConfig },
          method: data.methods.some((item) => item.name === current.method) ? current.method
            : data.methods.length === 1 ? data.methods[0].name : "",
        }));
        setCreateWorkflowStepStep(2);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        setCreateWorkflowStepLoading(false);
      }
    } else {
      setCreateWorkflowStepStep((current) => Math.min(4, current + 1));
    }
  }
  function previousCreateWorkflowStep() {
    setError("");
    setCreateWorkflowStepStep((current) => Math.max(1, current - 1));
  }
  async function submitCreateWorkflowStep() {
    const validationError = workflowStepError(4);
    if (validationError) { setError(validationError); return; }
    try {
      setCreateWorkflowStepLoading(true);
      setError("");
      await workflowStepsApi.createWorkflowStep({
        name: createWorkflowStepDraft.stepName.trim(),
        step_executor_id: createWorkflowStepDraft.stepExecutor,
        method: createWorkflowStepDraft.method,
        executor_config: Object.fromEntries(Object.entries(createWorkflowStepDraft.executorConfig).filter(([, value]) => value != null && value !== "")),
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
                derivativeGroupId: "",
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
                        item.sourceConfig?.table || "derivatives"
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
        name: draft.name.trim(),
        model_family: draft.modelFamily.trim(),
        payload: prompt,
        resources: draft.resources.map((resource) => ({
          name: resource.name.trim(),
          source_table: resource.table,
          batch_limit: Number(resource.batchLimit) || 1,
          conditions: resource.conditions.map((condition) => ({
            field_name: condition.field,
            operator: condition.operator,
            value_type: condition.valueType,
            value: condition.value,
          })),
        })),
      };
      console.log("[PayloadTemplate] create request payload", requestPayload);
      await workflowStepsApi.createPayloadTemplate(requestPayload);
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

  function closeCreateDerivativeGroup() {
    if (createDerivativeGroupLoading) return;
    setCreateDerivativeGroupOpen(false);
    setCreateDerivativeGroupStep(1);
    setCreateDerivativeGroupDraft(createDerivativeGroupDraftState());
  }

  function setCreateDerivativeGroupField(field, value) {
    setCreateDerivativeGroupDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDerivativeGroupCondition(kind, index, field, value) {
    const conditionsField =
      kind === "membership" ? "membershipConditions" : "sampleMappingConditions";
    setCreateDerivativeGroupDraft((current) => ({
      ...current,
      [conditionsField]: current[conditionsField].map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, [field]: value } : condition,
      ),
    }));
  }

  function addDerivativeGroupCondition(kind) {
    const conditionsField =
      kind === "membership" ? "membershipConditions" : "sampleMappingConditions";
    setCreateDerivativeGroupDraft((current) => ({
      ...current,
      [conditionsField]: [
        ...current[conditionsField],
        {
          field: "name",
          operator: "contains",
          valueType: kind === "membership" ? "manual" : "sample-field",
          value: kind === "membership" ? "" : "name",
        },
      ],
    }));
  }

  function removeDerivativeGroupCondition(kind, index) {
    const conditionsField =
      kind === "membership" ? "membershipConditions" : "sampleMappingConditions";
    setCreateDerivativeGroupDraft((current) => ({
      ...current,
      [conditionsField]: current[conditionsField].filter(
        (_, conditionIndex) => conditionIndex !== index,
      ),
    }));
  }

  function nextCreateDerivativeGroupStep() {
    if (createDerivativeGroupStep === 1) {
      if (!createDerivativeGroupDraft.groupName.trim()) {
        setError("Derivative group name is required.");
        return;
      }
    }
    if (createDerivativeGroupStep === 2) {
      if (!createDerivativeGroupDraft.membershipConditions.some(
        (condition) => condition.field && condition.value.trim(),
      )) {
        setError("Add a membership condition.");
        return;
      }
    }
    if (createDerivativeGroupStep === 3 && !createDerivativeGroupDraft.sampleMappingConditions.some(
      (condition) => condition.field && condition.value,
    )) {
      setError("Add a sample-mapping condition.");
      return;
    }
    setError("");
    setCreateDerivativeGroupStep((current) => Math.min(4, current + 1));
  }

  function previousCreateDerivativeGroupStep() {
    setError("");
    setCreateDerivativeGroupStep((current) => Math.max(1, current - 1));
  }

  async function submitCreateDerivativeGroup() {
    if (!createDerivativeGroupDraft.groupName.trim()) {
      setError("Derivative group name is required.");
      return;
    }
    if (!createDerivativeGroupDraft.membershipConditions.some((condition) => condition.value.trim())) {
      setError("Membership pattern is required.");
      return;
    }

    const membershipConditions = createDerivativeGroupDraft.membershipConditions
      .filter((condition) => condition.field && condition.value.trim());
    const sampleMappingConditions = createDerivativeGroupDraft.sampleMappingConditions
      .filter((condition) => condition.field && condition.value);
    if (!membershipConditions.length || !sampleMappingConditions.length) {
      setError("Add a membership condition and a sample-mapping condition.");
      return;
    }
    const membershipCondition = membershipConditions[0];
    const sampleMappingCondition = sampleMappingConditions[0];

    try {
      setCreateDerivativeGroupLoading(true);
      setError("");
      await workflowStepsApi.createDerivativeGroup({
        name: createDerivativeGroupDraft.groupName.trim(),
        description:
          createDerivativeGroupDraft.description.trim() || null,
        mapping_type: createDerivativeGroupDraft.mappingType,
        position_rule: {
          strategy: createDerivativeGroupDraft.ordering,
          membership_pattern: membershipCondition.value.trim(),
          membership_derivative_field: membershipCondition.field,
          membership_operator: membershipCondition.operator,
          membership_case_sensitive: false,
          sample_mapping_derivative_field: sampleMappingCondition.field,
          sample_mapping_sample_field: sampleMappingCondition.value,
          sample_mapping_operator: sampleMappingCondition.operator,
          sample_mapping_case_sensitive: false,
          membership_conditions: membershipConditions,
          sample_mapping_conditions: sampleMappingConditions,
        },
      });
      await refresh();
      closeCreateDerivativeGroup();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
    } finally {
      setCreateDerivativeGroupLoading(false);
    }
  }

  return {
    state: {
      loading,
      error,
      workflowStepType,
      filters,
      appliedFilters,
      visibleRecords,
      detailOpen,
      detailType,
      selectedResource,
      selectedDerivativeGroupIds,
      selectedPayloadTemplateIds,
      createDerivativeGroupOpen,
      createDerivativeGroupStep,
      createDerivativeGroupDraft,
      createDerivativeGroupLoading,
      createPayloadTemplateOpen,
      createPayloadTemplateDraft,
      createPayloadTemplateLoading,
      createPayloadTemplateStep,
      createOutputSpecOpen,
      createOutputSpecDraft,
      createOutputSpecLoading,
      executorDefinition,
      createWorkflowStepOpen,
      createWorkflowStepStep,
      createWorkflowStepDraft,
      createWorkflowStepLoading,
      ...sampleSetCreation.state,
      ...catalogs,
    },
    actions: {
      refresh,
      setWorkflowStepType,
      setFilterField,
      applyFilters,
      clearFilters,
      selectAllVisibleDerivativeGroups,
      clearDerivativeGroupSelection,
      toggleDerivativeGroupSelection,
      deleteSelectedDerivativeGroups,
      deleteSelectedPayloadTemplates,
      deleteWorkflowStep,
      deletePayloadTemplateFromWorkflowStep,
      deleteOutputSpecFromWorkflowStep,
      toggleWorkflowStepSelection,
      selectAllVisibleWorkflowSteps,
      clearWorkflowStepSelection,
      openWorkflowStepDetail,
      closeWorkflowStepDetail,
      openCreateDerivativeGroup,
      closeCreateDerivativeGroup,
      setCreateDerivativeGroupField,
      updateDerivativeGroupCondition,
      addDerivativeGroupCondition,
      removeDerivativeGroupCondition,
      nextCreateDerivativeGroupStep,
      previousCreateDerivativeGroupStep,
      submitCreateDerivativeGroup,
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
