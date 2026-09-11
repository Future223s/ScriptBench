"use client";

export const managementModes = {
  sample: {
    title: "Samples",
    description: "Search samples and review the current set.",
    createAction: "create-sample-set",
    createLabel: "Save sample set",
    deleteLabel: "Delete selected",
  },
  derivative: {
    title: "Derivatives",
    description: "Search derivatives and review the current set.",
    createAction: "create-derivative-group",
    createLabel: "Save derivative group",
    deleteLabel: "Delete selected",
  },
  asset: {
    title: "Assets",
    description: "Search assets and review the current set.",
    createAction: null,
    createLabel: "",
    deleteLabel: "Delete selected",
  },
};

export const DEFAULT_FILTERS = {
  sample: {
    query: "",
    queryMode: "contains",
    sampleSetId: "",
  },
  derivative: {
    query: "",
    queryMode: "contains",
    derivativeGroupId: "",
    derivativeCategory: "",
  },
  asset: {
    query: "",
    queryMode: "contains",
    assetType: "",
  },
  sampleSet: {
    query: "",
    status: "",
  },
  derivativeGroup: {
    query: "",
    queryMode: "contains",
    mappingType: "",
  },
};

export const DEFAULT_DRAFTS = {
  sampleSetName: "",
  sampleSetDescription: "",
  derivativeGroupName: "",
  derivativeGroupDescription: "",
};

export const DEFAULT_SELECTIONS = {
  sample: [],
  derivative: [],
  asset: [],
};

export const MANAGEMENT_DEFAULT_ACTION = {
  sample: "create-sample-set",
  derivative: "create-derivative-group",
  asset: "delete",
};

export function createEmptyFolderUploadProgress() {
  return {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    currentFile: null,
  };
}

export function cloneFilters(filters = DEFAULT_FILTERS) {
  return {
    sample: { ...filters.sample },
    derivative: { ...filters.derivative },
    asset: { ...filters.asset },
    sampleSet: { ...filters.sampleSet },
    derivativeGroup: { ...filters.derivativeGroup },
  };
}

export function cloneSelections(selections = DEFAULT_SELECTIONS) {
  return {
    sample: [...(selections.sample || [])],
    derivative: [...(selections.derivative || [])],
    asset: [...(selections.asset || [])],
  };
}

export function currentDefaultAction(type) {
  return MANAGEMENT_DEFAULT_ACTION[type] || MANAGEMENT_DEFAULT_ACTION.sample;
}

export function normalizeManagementType(type) {
  if (type === "derivative" || type === "asset") return type;
  return "sample";
}

export function normalizeManagementAction(type, action) {
  if (action) return action;
  return currentDefaultAction(normalizeManagementType(type));
}

export function objectTypeLabel(type) {
  if (type === "derivative") return "Derivatives";
  if (type === "asset") return "Assets";
  return "Samples";
}

export function recordIdToString(recordId) {
  return String(recordId ?? "");
}

export function recordIdForType(type, record) {
  if (type === "derivative") return recordIdToString(record?.id);
  if (type === "asset") return recordIdToString(record?.id);
  return recordIdToString(record?.id);
}

function metadataEntriesFromObject(source, excludedKeys) {
  return Object.entries(source || {}).filter(([key, value]) => {
    return (
      !excludedKeys.has(key) &&
      value !== undefined &&
      value !== null &&
      value !== ""
    );
  });
}

export function normalizeRecordPreview(type, record, derivativeGroups = []) {
  const normalizedType = normalizeManagementType(type);
  if (!record) return null;

  if (normalizedType === "derivative") {
    const metadata = [
      ["ID", record.id],
      ["Origin", record.sample_id],
      ["Group", derivativeGroupLookup(derivativeGroups).get(String(record.derivative_group_id))?.name || "Ungrouped"],
      ["Category", record.category],
      ["Mime", record.mime_type],
      [
        "Size",
        record.blob_size ? `${record.blob_size} bytes` : "",
      ],
    ].filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    );

    return {
      id: recordIdToString(record.id),
      name: record.name || "Derivative",
      type: normalizedType,
      typeLabel: "Derivative",
      mimeType: record.mime_type || "",
      blobBase64: record.blob_base64 || "",
      blobSize: record.blob_size || 0,
      metadata,
      detailSections: [
        {
          title: "Derivative details",
          content: JSON.stringify(
            {
              derivative_group_id: record.derivative_group_id || null,
              category: record.category || "",
              sample_id: record.sample_id || null,
            },
            null,
            2,
          ),
        },
      ],
      additionalMetadata: metadataEntriesFromObject(
        record,
        new Set([
          "id",
          "name",
          "sample_id",
          "derivative_group_id",
          "category",
          "mime_type",
          "blob_size",
          "blob_base64",
        ]),
      ),
      raw: record,
    };
  }

  if (normalizedType === "asset") {
    const metadata = [
      ["ID", record.id],
      ["Type", record.type],
      ["Mime", record.mime_type],
      ["Size", record.blob_size ? `${record.blob_size} bytes` : ""],
    ].filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    );

    return {
      id: recordIdToString(record.id),
      name: record.name || "Asset",
      type: normalizedType,
      typeLabel: "Asset",
      mimeType: record.mime_type || "",
      blobBase64: record.blob_base64 || "",
      blobSize: record.blob_size || 0,
      metadata,
      additionalMetadata: metadataEntriesFromObject(
        record,
        new Set([
          "id",
          "name",
          "type",
          "mime_type",
          "blob_size",
          "blob_base64",
        ]),
      ),
      raw: record,
    };
  }

  const metadata = [
    ["ID", record.id],
    ["Mime", record.mime_type],
    ["Size", record.blob_size ? `${record.blob_size} bytes` : ""],
  ].filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  return {
    id: recordIdToString(record.id),
    name: record.name || record.id || "Sample",
    type: "sample",
    typeLabel: "Sample",
    mimeType: record.mime_type || "",
    blobBase64: record.blob_base64 || "",
    blobSize: record.blob_size || 0,
    metadata,
    detailSections: [
      {
        title: "Ground truth",
        content: record.ground_truth_text || "",
      },
    ],
    additionalMetadata: metadataEntriesFromObject(
      record,
      new Set([
        "id",
        "name",
        "mime_type",
        "blob_size",
        "blob_base64",
        "ground_truth_text",
      ]),
    ),
    groundTruthText: record.ground_truth_text || "",
    raw: record,
  };
}

export function uniqueList(values) {
  return [
    ...new Set(
      values.filter(
        (value) => value !== "" && value !== null && value !== undefined,
      ),
    ),
  ];
}

export function buildSelectionSet(values) {
  return uniqueList(values.map((value) => recordIdToString(value)));
}

function matchesTextMode(value, query, mode) {
  const normalizedValue = String(value ?? "").toLowerCase();
  const normalizedQuery = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return true;
  if (mode === "exact") return normalizedValue === normalizedQuery;
  if (mode === "starts-with")
    return normalizedValue.startsWith(normalizedQuery);
  return normalizedValue.includes(normalizedQuery);
}

export function createSampleFilterConfig({ filters, sampleSets, onChange }) {
  return [
    {
      id: "sample-search",
      label: "Search",
      kind: "text",
      value: filters.query,
      placeholder: "Sample ID, name, or ground truth",
      onChange: (value) => onChange("query", value),
    },
    {
      id: "sample-match-mode",
      label: "Match",
      kind: "select",
      value: filters.queryMode,
      onChange: (value) => onChange("queryMode", value),
      options: [
        { value: "contains", label: "Contains" },
        { value: "starts-with", label: "Begins with" },
        { value: "exact", label: "Exact" },
      ],
    },
    {
      id: "sample-set-filter",
      label: "Sample set",
      kind: "select",
      value: filters.sampleSetId,
      onChange: (value) => onChange("sampleSetId", value),
      options: [
        { value: "", label: "All sample sets" },
        ...(sampleSets || []).map((sampleSet) => ({
          value: String(sampleSet.id),
          label: sampleSet.name,
        })),
      ],
    },
  ];
}

export function createSampleSetFilterConfig({ filters, onChange }) {
  return [
    {
      id: "sample-set-search",
      label: "Search",
      kind: "text",
      value: filters.query,
      placeholder: "Name or description",
      onChange: (value) => onChange("query", value),
    },
    {
      id: "sample-set-status",
      label: "Status",
      kind: "select",
      value: filters.status,
      onChange: (value) => onChange("status", value),
      options: [
        { value: "", label: "All statuses" },
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
      ],
    },
  ];
}

export function createDerivativeGroupFilterConfig({
  filters,
  derivativeGroups,
  onChange,
}) {
  const mappingTypes = [
    ...new Set(
      (derivativeGroups || []).map((group) => group.mapping_type).filter(Boolean),
    ),
  ].sort();
  return [
    {
      id: "derivative-group-search",
      label: "Search",
      kind: "text",
      value: filters.query,
      placeholder: "Name or description",
      onChange: (value) => onChange("query", value),
    },
    {
      id: "derivative-group-mapping-type",
      label: "Mapping type",
      kind: "select",
      value: filters.mappingType,
      onChange: (value) => onChange("mappingType", value),
      options: [
        { value: "", label: "All mapping types" },
        ...mappingTypes.map((value) => ({ value, label: value })),
      ],
    },
    {
      id: "derivative-group-match-mode",
      label: "Match",
      kind: "select",
      value: filters.queryMode,
      onChange: (value) => onChange("queryMode", value),
      options: [
        { value: "contains", label: "Contains" },
        { value: "starts-with", label: "Begins with" },
        { value: "exact", label: "Exact" },
      ],
    },
  ];
}

function sampleSetLookup(sampleSets) {
  return new Map(
    (sampleSets || []).map((sampleSet) => [
      String(sampleSet.id),
      sampleSet,
    ]),
  );
}

function derivativeGroupLookup(derivativeGroups) {
  return new Map(
    (derivativeGroups || []).map((group) => [
      String(group.id),
      group,
    ]),
  );
}

function visibleSamples(state) {
  const filters = state.appliedFilters.sample;
  const sampleSetMap = sampleSetLookup(state.sampleSets);
  const selectedSampleSet = filters.sampleSetId
    ? sampleSetMap.get(String(filters.sampleSetId))
    : null;
  const sampleIdsInSet = selectedSampleSet
    ? new Set(selectedSampleSet.sample_ids || [])
    : null;

  return (state.samples || []).filter((sample) => {
    if (sampleIdsInSet && !sampleIdsInSet.has(sample.id)) return false;
    return (
      matchesTextMode(
        sample.name || sample.id,
        filters.query,
        filters.queryMode,
      ) ||
      matchesTextMode(sample.id, filters.query, filters.queryMode) ||
      matchesTextMode(
        sample.ground_truth_text || "",
        filters.query,
        filters.queryMode,
      )
    );
  });
}

function visibleDerivatives(state) {
  const filters = state.appliedFilters.derivative;
  const groupLookup = derivativeGroupLookup(state.derivativeGroups);

  return (state.derivatives || []).filter((derivative) => {
    if (
      filters.derivativeGroupId &&
      String(derivative.derivative_group_id || "") !==
        String(filters.derivativeGroupId)
    ) {
      return false;
    }
    if (
      filters.derivativeCategory &&
      String(derivative.category || "").toLowerCase() !==
        String(filters.derivativeCategory).toLowerCase()
    ) {
      return false;
    }
    const groupName =
      groupLookup.get(String(derivative.derivative_group_id || ""))?.name ||
      "";
    return (
      matchesTextMode(
        derivative.name,
        filters.query,
        filters.queryMode,
      ) ||
      matchesTextMode(
        derivative.sample_id,
        filters.query,
        filters.queryMode,
      ) ||
      matchesTextMode(groupName, filters.query, filters.queryMode) ||
      matchesTextMode(
        derivative.category,
        filters.query,
        filters.queryMode,
      )
    );
  });
}

function visibleAssets(state) {
  const filters = state.appliedFilters.asset;

  return (state.assets || []).filter((asset) => {
    if (
      filters.assetType &&
      String(asset.type || "").toLowerCase() !==
        String(filters.assetType).toLowerCase()
    ) {
      return false;
    }
    return (
      matchesTextMode(asset.name, filters.query, filters.queryMode) ||
      matchesTextMode(asset.type, filters.query, filters.queryMode) ||
      matchesTextMode(
        asset.mime_type || "",
        filters.query,
        filters.queryMode,
      )
    );
  });
}

function visibleSampleSets(state) {
  const filters = state.appliedFilters.sampleSet;
  return (state.sampleSets || []).filter(
    (sampleSet) =>
      matchesTextMode(
        `${sampleSet.name || ""} ${sampleSet.description || ""}`,
        filters.query,
        "contains",
      ) &&
      (!filters.status || sampleSet.status === filters.status),
  );
}

function visibleDerivativeGroups(state) {
  const filters = state.appliedFilters.derivativeGroup;
  return (state.derivativeGroups || []).filter(
    (group) =>
      matchesTextMode(
        `${group.name || ""} ${group.description || ""}`,
        filters.query,
        filters.queryMode,
      ) &&
      (!filters.mappingType || group.mapping_type === filters.mappingType),
  );
}

export function visibleRecordsForType(state, type) {
  if (type === "sampleSet") return visibleSampleSets(state);
  if (type === "derivativeGroup") return visibleDerivativeGroups(state);
  if (type === "derivative") return visibleDerivatives(state);
  if (type === "asset") return visibleAssets(state);
  return visibleSamples(state);
}
