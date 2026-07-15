import { apiFetch } from "../client";

export type ApiId = string | number;

export interface SampleRecord {
  sample_id: string;
  sample_name: string;
  sample_mime_type?: string | null;
  ground_truth_text?: string | null;
  created_at?: string;
  updated_at?: string;
  has_sample_blob?: boolean;
  sample_blob_size?: number;
  sample_blob_base64?: string | null;
}

export interface SampleSetSummary {
  sample_set_id: ApiId;
  sample_set_name: string;
  sample_set_description?: string | null;
  sample_set_type?: string | null;
  sample_count?: number;
  workflow_count?: number;
  sample_ids?: string[];
  sample_ids_preview?: string[];
}

export interface ArtifactGroupRecord {
  artifact_group_id: ApiId;
  artifact_group_name: string;
  artifact_group_description?: string | null;
  matching_type?: string;
  matching_rule?: Record<string, unknown>;
  position_rule?: string | Record<string, unknown> | null;
  mapping_type?: string;
  created_at?: string;
  updated_at?: string;
  artifact_ids?: ApiId[];
  artifact_count?: number;
  artifact_ids_preview?: ApiId[];
}

export interface ArtifactRecord {
  artifact_id: number;
  artifact_name: string;
  originating_sample_id?: string | null;
  artifact_group_id?: number | null;
  artifact_group_name?: string | null;
  artifact_category: string;
  artifact_mime_type?: string | null;
  created_at?: string;
  updated_at?: string;
  has_artifact_blob?: boolean;
  artifact_blob_size?: number;
  artifact_blob_base64?: string | null;
}

export interface AssetRecord {
  asset_id: number;
  asset_name: string;
  asset_type: string;
  asset_mime_type?: string | null;
  created_at?: string;
  updated_at?: string;
  has_asset_blob?: boolean;
  asset_blob_size?: number;
  asset_blob_base64?: string | null;
}

export interface CreateAssetPayload {
  asset_name: string;
  asset_type: string;
}

export interface CreateSampleSetPayload {
  name: string;
  description?: string | null;
  type?: string | null;
  sample_ids: string[];
}

export interface CreateSamplePayload {
  sample_id: string;
  sample_name: string;
  ground_truth_text?: string | null;
}

export interface CreateArtifactGroupPayload {
  name: string;
  description?: string | null;
  artifact_ids: number[];
  matching_type?: string;
  mapping_type?: string;
  matching_rule?: Record<string, unknown>;
}

export interface SamplesResponse {
  samples: SampleRecord[];
  sample_count: number;
}

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export interface ArtifactGroupsResponse {
  artifact_groups: ArtifactGroupRecord[];
  artifact_group_count: number;
}

export interface ArtifactsResponse {
  artifacts: ArtifactRecord[];
  artifact_count: number;
}

export interface AssetsResponse {
  assets: AssetRecord[];
  asset_count: number;
}

export interface ArtifactMapItem {
  artifact_id?: number;
  artifact_name: string;
  artifact_mime_type?: string | null;
  artifact_category?: string | null;
  originating_sample_id?: string | null;
  artifact_group_id?: number | null;
  artifact_group_name?: string | null;
  artifact_blob_base64?: string | null;
  artifact_blob_size?: number | null;
}

export interface ArtifactMapResult extends ArtifactMapItem {
  mapping_type?: string | null;
  errors?: string[];
}

export interface ArtifactMapResponse {
  mapped_artifacts: ArtifactMapResult[];
  rejected_artifacts: Array<Record<string, unknown>>;
  mapped_count: number;
  rejected_count: number;
}

export interface ArtifactCreateResult extends ArtifactMapItem {
  artifact_id?: number;
  artifact_group_id?: number | null;
  artifact_group_name?: string | null;
  artifact_category?: string | null;
  artifact_blob_base64?: string | null;
}

export interface ArtifactCreateRequestItem {
  artifact_name: string;
  originating_sample_id?: string | null;
  artifact_category?: string | null;
  artifact_mime_type?: string | null;
  artifact_blob_base64: string;
}

export interface ArtifactPatchRequestItem {
  artifact_id: number;
  artifact_group_id?: number | null;
  artifact_group_name?: string | null;
  originating_sample_id?: string | null;
}

export interface ArtifactCreateResponse {
  data?: ArtifactCreateResult[] | null;
}

export interface FileUploadQueueResponse {
  upload_batch_id: string;
  queued_files: number;
  upload_type: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
}

export interface ApiListResponse<T> {
  success: boolean;
  message: string;
  items: T[];
  count: number;
}

function browserBackendBaseUrl() {
  const configured =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "";
  if (configured && !configured.includes("://backend:")) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window === "undefined") return "";
  return "http://127.0.0.1:8000";
}

function directBackendUrl(path: string) {
  const baseUrl = browserBackendBaseUrl();
  if (!baseUrl) return path;
  return `${baseUrl}${path}`;
}

function encodeId(value: ApiId) {
  return encodeURIComponent(String(value));
}

function appendListEntries(formData: FormData, key: string, values: Array<string | Blob | File | null | undefined>) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    formData.append(key, value);
  }
}

export function createSampleBlobFormData(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function createAssetsFormData(items: Array<{
  asset_name: string;
  asset_type?: string | null;
  file: File;
}>) {
  const formData = new FormData();
  appendListEntries(formData, "asset_names", items.map((item) => item.asset_name));
  appendListEntries(formData, "asset_types", items.map((item) => item.asset_type ?? ""));
  appendListEntries(formData, "files", items.map((item) => item.file));
  return formData;
}

export function createArtifactBlobFormData(file: File, artifactMimeType?: string | null) {
  const formData = new FormData();
  formData.append("file", file);
  if (artifactMimeType) {
    formData.append("artifact_mime_type", artifactMimeType);
  }
  return formData;
}

export const fileManagementApi = {
  getSamples: async () => {
    const response = await apiFetch<ApiListResponse<SampleRecord>>("/api/v2/samples");
    return {
      samples: response.items || [],
      sample_count: response.count || 0,
    } satisfies SamplesResponse;
  },
  getSample: async (sampleId: ApiId) => {
    const response = await apiFetch<ApiResponse<SampleRecord>>(`/api/v2/samples/${encodeId(sampleId)}`);
    if (!response.data) {
      throw new Error("Sample response did not include sample data.");
    }
    return response.data;
  },
  createSample: async (payload: CreateSamplePayload) => {
    const response = await apiFetch<ApiResponse<SampleRecord>>("/api/v2/samples", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.data) {
      throw new Error("Sample create response did not include sample data.");
    }
    return response.data;
  },
  uploadSampleBlob: async (sampleId: ApiId, formData: FormData) => {
    const response = await apiFetch<ApiResponse<{ sample_id: ApiId }>>(`/api/v2/samples/${encodeId(sampleId)}/blob`, {
      method: "PUT",
      body: formData,
    });
    if (!response.data) {
      throw new Error("Sample blob upload response did not include sample data.");
    }
    return response.data;
  },
  deleteSamples: (sampleIds: string[]) =>
    apiFetch<void>("/api/v2/samples", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample_ids: sampleIds }),
    }),
  deleteSample: (sampleId: ApiId) =>
    apiFetch<void>(`/api/v2/samples/${encodeId(sampleId)}`, {
      method: "DELETE",
    }),

  getSampleSets: () => apiFetch<SampleSetsResponse>("/api/v2/sample-sets"),
  createSampleSet: (payload: CreateSampleSetPayload) =>
    apiFetch<SampleSetSummary>("/api/v2/sample-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<{ sample_set_id: ApiId; deleted: true }>(`/api/v2/sample-sets/${encodeId(sampleSetId)}`, {
      method: "DELETE",
    }),

  getArtifactGroups: () => apiFetch<ArtifactGroupsResponse>("/api/v2/artifact-groups"),
  createArtifactGroup: (payload: CreateArtifactGroupPayload) =>
    apiFetch<ArtifactGroupRecord>("/api/v2/artifact-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteArtifactGroup: (artifactGroupId: ApiId) =>
    apiFetch<{ artifact_group_id: ApiId; deleted: true }>(
      `/api/v2/artifact-groups/${encodeId(artifactGroupId)}`,
      {
        method: "DELETE",
      },
    ),

  getArtifacts: async () => {
    const response = await apiFetch<ApiListResponse<ArtifactRecord>>("/api/v2/artifacts");
    return {
      artifacts: response.items || [],
      artifact_count: response.count || 0,
    } satisfies ArtifactsResponse;
  },
  getArtifact: async (artifactId: ApiId) => {
    const response = await apiFetch<ApiResponse<ArtifactRecord>>(`/api/v2/artifacts/${encodeId(artifactId)}`);
    if (!response.data) {
      throw new Error("Artifact response did not include artifact data.");
    }
    return response.data;
  },
  mapArtifacts: (artifacts: ArtifactMapItem[]) =>
    apiFetch<ApiResponse<ArtifactMapResponse>>(directBackendUrl("/api/v2/artifacts/map"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifacts }),
    }),
  createArtifacts: (artifacts: ArtifactCreateRequestItem[]) =>
    apiFetch<ApiResponse<ArtifactCreateResult[]>>(directBackendUrl("/api/v2/artifacts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifacts }),
    }),
  patchArtifacts: (artifacts: ArtifactPatchRequestItem[]) =>
    apiFetch<ApiResponse<ArtifactCreateResult[]>>(directBackendUrl("/api/v2/artifacts"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifacts }),
    }),
  uploadArtifactBlob: (artifactId: ApiId, formData: FormData) =>
    apiFetch<FileUploadQueueResponse>(directBackendUrl(`/api/v2/artifacts/${encodeId(artifactId)}/blob`), {
      method: "PUT",
      body: formData,
    }),
  deleteArtifacts: (artifactIds: number[]) =>
    apiFetch<void>("/api/v2/artifacts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artifact_ids: artifactIds }),
    }),
  deleteArtifact: (artifactId: ApiId) =>
    apiFetch<void>(`/api/v2/artifacts/${encodeId(artifactId)}`, {
      method: "DELETE",
    }),

  getAssets: async () => {
    const response = await apiFetch<ApiListResponse<AssetRecord>>("/api/v2/assets");
    return {
      assets: response.items || [],
      asset_count: response.count || 0,
    } satisfies AssetsResponse;
  },
  getAsset: async (assetId: ApiId) => {
    const response = await apiFetch<ApiResponse<AssetRecord>>(`/api/v2/assets/${encodeId(assetId)}`);
    if (!response.data) {
      throw new Error("Asset response did not include asset data.");
    }
    return response.data;
  },
  createAsset: async (payload: CreateAssetPayload) => {
    const response = await apiFetch<ApiResponse<AssetRecord>>("/api/v2/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.data) {
      throw new Error("Asset create response did not include asset data.");
    }
    return response.data;
  },
  uploadAssetBlob: (assetId: ApiId, formData: FormData) =>
    apiFetch<{ asset_id: ApiId }>(`/api/v2/assets/${encodeId(assetId)}/blob`, {
      method: "PUT",
      body: formData,
    }),
  deleteAssets: (assetIds: number[]) =>
    apiFetch<void>("/api/v2/assets", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ asset_ids: assetIds }),
    }),
  deleteAsset: (assetId: ApiId) =>
    apiFetch<void>(`/api/v2/assets/${encodeId(assetId)}`, {
      method: "DELETE",
    }),
} as const;
