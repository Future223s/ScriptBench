"use client";

export const managementModes = {
  sample: {
    title: "Samples",
    description: "Search samples and review the current set.",
    createAction: "create-sample-set",
    createLabel: "Save sample set",
    deleteLabel: "Delete selected",
  },
  artifact: {
    title: "Artifacts",
    description: "Search artifacts and review the current set.",
    createAction: "create-artifact-group",
    createLabel: "Save artifact group",
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
  artifact: {
    query: "",
    queryMode: "contains",
    artifactGroupId: "",
    artifactCategory: "",
  },
  asset: {
    query: "",
    queryMode: "contains",
    assetType: "",
  },
};

export const DEFAULT_DRAFTS = {
  sample_set_name: "",
  sample_set_description: "",
  artifact_group_name: "",
  artifact_group_description: "",
};

export const DEFAULT_SELECTIONS = {
  sample: [],
  artifact: [],
  asset: [],
};

export const MANAGEMENT_DEFAULT_ACTION = {
  sample: "create-sample-set",
  artifact: "create-artifact-group",
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
    artifact: { ...filters.artifact },
    asset: { ...filters.asset },
  };
}

export function cloneSelections(selections = DEFAULT_SELECTIONS) {
  return {
    sample: [...(selections.sample || [])],
    artifact: [...(selections.artifact || [])],
    asset: [...(selections.asset || [])],
  };
}

export function currentDefaultAction(type) {
  return MANAGEMENT_DEFAULT_ACTION[type] || MANAGEMENT_DEFAULT_ACTION.sample;
}

export function normalizeManagementType(type) {
  if (type === "artifact" || type === "asset") return type;
  return "sample";
}

export function normalizeManagementAction(type, action) {
  if (action) return action;
  return currentDefaultAction(normalizeManagementType(type));
}

export function objectTypeLabel(type) {
  if (type === "artifact") return "Artifacts";
  if (type === "asset") return "Assets";
  return "Samples";
}

export function recordIdToString(recordId) {
  return String(recordId ?? "");
}

export function recordIdForType(type, record) {
  if (type === "artifact") return recordIdToString(record?.artifact_id);
  if (type === "asset") return recordIdToString(record?.asset_id);
  return recordIdToString(record?.sample_id);
}

function metadataEntriesFromObject(source, excludedKeys) {
  return Object.entries(source || {}).filter(([key, value]) => {
    return !excludedKeys.has(key) && value !== undefined && value !== null && value !== "";
  });
}

export function normalizeRecordPreview(type, record) {
  const normalizedType = normalizeManagementType(type);
  if (!record) return null;

  if (normalizedType === "artifact") {
    const metadata = [
      ["ID", record.artifact_id],
      ["Origin", record.originating_sample_id],
      ["Group", record.artifact_group_name || "Ungrouped"],
      ["Category", record.artifact_category],
      ["Mime", record.artifact_mime_type],
      ["Size", record.artifact_blob_size ? `${record.artifact_blob_size} bytes` : ""],
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    return {
      id: recordIdToString(record.artifact_id),
      name: record.artifact_name || "Artifact",
      type: normalizedType,
      typeLabel: "Artifact",
      mimeType: record.artifact_mime_type || "",
      blobBase64: record.artifact_blob_base64 || "",
      blobSize: record.artifact_blob_size || 0,
      metadata,
      detailSections: [
        {
          title: "Artifact details",
          content: JSON.stringify(
            {
              artifact_group_id: record.artifact_group_id || null,
              artifact_group_name: record.artifact_group_name || "",
              artifact_category: record.artifact_category || "",
              originating_sample_id: record.originating_sample_id || null,
            },
            null,
            2,
          ),
        },
      ],
      additionalMetadata: metadataEntriesFromObject(record, new Set([
        "artifact_id",
        "artifact_name",
        "originating_sample_id",
        "artifact_group_id",
        "artifact_group_name",
        "artifact_category",
        "artifact_mime_type",
        "artifact_blob_size",
        "artifact_blob_base64",
      ])),
      raw: record,
    };
  }

  if (normalizedType === "asset") {
    const metadata = [
      ["ID", record.asset_id],
      ["Type", record.asset_type],
      ["Mime", record.asset_mime_type],
      ["Size", record.asset_blob_size ? `${record.asset_blob_size} bytes` : ""],
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    return {
      id: recordIdToString(record.asset_id),
      name: record.asset_name || "Asset",
      type: normalizedType,
      typeLabel: "Asset",
      mimeType: record.asset_mime_type || "",
      blobBase64: record.asset_blob_base64 || "",
      blobSize: record.asset_blob_size || 0,
      metadata,
      additionalMetadata: metadataEntriesFromObject(record, new Set([
        "asset_id",
        "asset_name",
        "asset_type",
        "asset_mime_type",
        "asset_blob_size",
        "asset_blob_base64",
      ])),
      raw: record,
    };
  }

  const metadata = [
    ["ID", record.sample_id],
    ["Mime", record.sample_mime_type],
    ["Size", record.sample_blob_size ? `${record.sample_blob_size} bytes` : ""],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return {
    id: recordIdToString(record.sample_id),
    name: record.sample_name || record.sample_id || "Sample",
    type: "sample",
    typeLabel: "Sample",
    mimeType: record.sample_mime_type || "",
    blobBase64: record.sample_blob_base64 || "",
    blobSize: record.sample_blob_size || 0,
    metadata,
    detailSections: [
      {
        title: "Ground truth",
        content: record.ground_truth_text || "",
      },
    ],
    additionalMetadata: metadataEntriesFromObject(record, new Set([
      "sample_id",
      "sample_name",
      "sample_mime_type",
      "sample_blob_size",
      "sample_blob_base64",
      "ground_truth_text",
    ])),
    groundTruthText: record.ground_truth_text || "",
    raw: record,
  };
}

export function uniqueList(values) {
  return [...new Set(values.filter((value) => value !== "" && value !== null && value !== undefined))];
}

export function buildSelectionSet(values) {
  return uniqueList(values.map((value) => recordIdToString(value)));
}

function matchesTextMode(value, query, mode) {
  const normalizedValue = String(value ?? "").toLowerCase();
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (mode === "exact") return normalizedValue === normalizedQuery;
  if (mode === "starts-with") return normalizedValue.startsWith(normalizedQuery);
  return normalizedValue.includes(normalizedQuery);
}

function sampleSetLookup(sampleSets) {
  return new Map((sampleSets || []).map((sampleSet) => [String(sampleSet.sample_set_id), sampleSet]));
}

function artifactGroupLookup(artifactGroups) {
  return new Map((artifactGroups || []).map((group) => [String(group.artifact_group_id), group]));
}

function visibleSamples(state) {
  const filters = state.appliedFilters.sample;
  const sampleSetMap = sampleSetLookup(state.sampleSets);
  const selectedSampleSet = filters.sampleSetId ? sampleSetMap.get(String(filters.sampleSetId)) : null;
  const sampleIdsInSet = selectedSampleSet ? new Set(selectedSampleSet.sample_ids || []) : null;

  return (state.samples || []).filter((sample) => {
    if (sampleIdsInSet && !sampleIdsInSet.has(sample.sample_id)) return false;
    return (
      matchesTextMode(sample.sample_name || sample.sample_id, filters.query, filters.queryMode)
      || matchesTextMode(sample.sample_id, filters.query, filters.queryMode)
      || matchesTextMode(sample.ground_truth_text || "", filters.query, filters.queryMode)
    );
  });
}

function visibleArtifacts(state) {
  const filters = state.appliedFilters.artifact;
  const groupLookup = artifactGroupLookup(state.artifactGroups);

  return (state.artifacts || []).filter((artifact) => {
    if (filters.artifactGroupId && String(artifact.artifact_group_id || "") !== String(filters.artifactGroupId)) {
      return false;
    }
    if (filters.artifactCategory && String(artifact.artifact_category || "").toLowerCase() !== String(filters.artifactCategory).toLowerCase()) {
      return false;
    }
    const groupName = artifact.artifact_group_name || groupLookup.get(String(artifact.artifact_group_id || ""))?.artifact_group_name || "";
    return (
      matchesTextMode(artifact.artifact_name, filters.query, filters.queryMode)
      || matchesTextMode(artifact.originating_sample_id, filters.query, filters.queryMode)
      || matchesTextMode(groupName, filters.query, filters.queryMode)
      || matchesTextMode(artifact.artifact_category, filters.query, filters.queryMode)
    );
  });
}

function visibleAssets(state) {
  const filters = state.appliedFilters.asset;

  return (state.assets || []).filter((asset) => {
    if (filters.assetType && String(asset.asset_type || "").toLowerCase() !== String(filters.assetType).toLowerCase()) {
      return false;
    }
    return (
      matchesTextMode(asset.asset_name, filters.query, filters.queryMode)
      || matchesTextMode(asset.asset_type, filters.query, filters.queryMode)
      || matchesTextMode(asset.asset_mime_type || "", filters.query, filters.queryMode)
    );
  });
}

export function visibleRecordsForType(state, type) {
  if (type === "artifact") return visibleArtifacts(state);
  if (type === "asset") return visibleAssets(state);
  return visibleSamples(state);
}
