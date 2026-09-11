import { apiFetch } from "../client";

export type ApiId = string | number;

export interface SampleRecord {
  id: string;
  name: string;
  mime_type?: string | null;
  ground_truth_text?: string | null;
  created_at?: string;
  updated_at?: string;
  has_blob?: boolean;
  blob_size?: number;
  blob_base64?: string | null;
}

export interface SampleSetSummary {
  id: ApiId;
  name: string;
  description?: string | null;
  sample_count?: number;
  workflow_count?: number;
  sample_ids?: string[];
  sample_ids_preview?: string[];
}

export interface DerivativeGroupRecord {
  id: ApiId;
  name: string;
  description?: string | null;
  position_rule?: Record<string, unknown> | null;
  mapping_type: string;
  status: string;
  created_at: string;
}

export interface DerivativeRecord {
  id: number;
  name: string;
  sample_id?: string | null;
  derivative_group_id?: number | null;
  category: string;
  mime_type?: string | null;
  created_at?: string;
  updated_at?: string;
  has_blob?: boolean;
  blob_size?: number;
  blob_base64?: string | null;
}

export interface AssetRecord {
  id: number;
  name: string;
  type: string;
  mime_type?: string | null;
  created_at?: string;
  updated_at?: string;
  has_blob?: boolean;
  blob_size?: number;
  blob_base64?: string | null;
}

export interface CreateAssetPayload {
  name: string;
  type: string;
}

export interface CreateSampleSetPayload {
  name: string;
  description?: string | null;
  sample_ids: string[];
}

export interface CreateSamplePayload {
  id: string;
  name: string;
  ground_truth_text?: string | null;
}

export interface CreateDerivativeGroupPayload {
  name: string;
  description?: string | null;
  derivative_ids: number[];
  mapping_type?: string;
  position_rule?: Record<string, unknown> | null;
}

export interface SamplesResponse {
  samples: SampleRecord[];
  sample_count: number;
}

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export interface DerivativeGroupsResponse {
  derivative_groups: DerivativeGroupRecord[];
  derivative_group_count: number;
}

export interface DerivativesResponse {
  derivatives: DerivativeRecord[];
  derivative_count: number;
}

export interface AssetsResponse {
  assets: AssetRecord[];
  asset_count: number;
}

export interface DerivativeMapItem {
  id: number;
  name: string;
}

export interface DerivativeMapResult extends DerivativeMapItem {
  sample_id?: string | null;
  derivative_group_id?: number | null;
  category?: string | null;
  mime_type?: string | null;
  blob_base64?: string | null;
  blob_size?: number | null;
  mapping_type?: string | null;
  errors?: string[];
}

export interface DerivativeMapResponse {
  mapped_derivatives: DerivativeMapResult[];
  rejected_derivatives: Array<Record<string, unknown>>;
  mapped_count: number;
  rejected_count: number;
}

export interface DerivativeCreateResult extends DerivativeMapItem {
  derivative_group_id?: number | null;
  category?: string | null;
  blob_base64?: string | null;
}

export interface DerivativeCreateRequestItem {
  name: string;
  mime_type: string;
}

export interface DerivativePatchRequestItem {
  id: number;
  derivative_group_id?: number | null;
  sample_id?: string | null;
  category?: string | null;
  mime_type?: string | null;
}

export interface DerivativeMapApiResponse {
  success: boolean;
  message: string;
  data?: DerivativeMapResponse | null;
}

export interface DerivativeCreateResponse {
  success: boolean;
  message: string;
  data?: DerivativeCreateResult[] | null;
}

export interface DerivativePatchResponse {
  success: boolean;
  message: string;
  data?: DerivativeRecord[] | null;
}

export interface DerivativeUploadBlobResponse {
  success: boolean;
  message: string;
  data?: DerivativeRecord[] | null;
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
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
    "";
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

function appendListEntries(
  formData: FormData,
  key: string,
  values: Array<string | Blob | File | null | undefined>,
) {
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

export function createAssetsFormData(
  items: Array<{
    name: string;
    type?: string | null;
    file: File;
  }>,
) {
  const formData = new FormData();
  appendListEntries(
    formData,
    "asset_names",
    items.map((item) => item.name),
  );
  appendListEntries(
    formData,
    "asset_types",
    items.map((item) => item.type ?? ""),
  );
  appendListEntries(
    formData,
    "files",
    items.map((item) => item.file),
  );
  return formData;
}

export function createDerivativeBlobFormData(
  file: File,
  derivativeMimeType?: string | null,
) {
  const formData = new FormData();
  formData.append("file", file);
  if (derivativeMimeType) {
    formData.append("mime_type", derivativeMimeType);
  }
  return formData;
}

export const fileManagementApi = {
  getSamples: async () => {
    const response =
      await apiFetch<ApiListResponse<SampleRecord>>("/api/v2/samples");
    return {
      samples: response.items || [],
      sample_count: response.count || 0,
    } satisfies SamplesResponse;
  },
  getSample: async (sampleId: ApiId) => {
    const response = await apiFetch<ApiResponse<SampleRecord>>(
      `/api/v2/samples/${encodeId(sampleId)}`,
    );
    if (!response.data) {
      throw new Error("Sample response did not include sample data.");
    }
    return response.data;
  },
  createSample: async (payload: CreateSamplePayload) => {
    const response = await apiFetch<ApiResponse<SampleRecord>>(
      "/api/v2/samples",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.data) {
      throw new Error("Sample create response did not include sample data.");
    }
    return response.data;
  },
  uploadSampleBlob: async (sampleId: ApiId, formData: FormData) => {
    const response = await apiFetch<ApiResponse<{ sample_id: ApiId }>>(
      `/api/v2/samples/${encodeId(sampleId)}/blob`,
      {
        method: "PUT",
        body: formData,
      },
    );
    if (!response.data) {
      throw new Error(
        "Sample blob upload response did not include sample data.",
      );
    }
    return response.data;
  },
  deleteSamples: (sampleIds: string[]) =>
    apiFetch<void>("/api/v2/samples", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: sampleIds }),
    }),
  deleteSample: (sampleId: ApiId) =>
    apiFetch<void>(`/api/v2/samples/${encodeId(sampleId)}`, {
      method: "DELETE",
    }),

  getSampleSets: async () => {
    const response = await apiFetch<ApiListResponse<SampleSetSummary>>(
      "/api/v2/sample-sets",
    );
    return {
      sample_sets: response.items || [],
      sample_set_count: response.count || 0,
    } satisfies SampleSetsResponse;
  },
  createSampleSet: (payload: CreateSampleSetPayload) =>
    apiFetch<SampleSetSummary>("/api/v2/sample-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<{ sample_set_id: ApiId; deleted: true }>(
      `/api/v2/sample-sets/${encodeId(sampleSetId)}`,
      {
        method: "DELETE",
      },
    ),

  getDerivativeGroups: async () => {
    const response = await apiFetch<ApiListResponse<DerivativeGroupRecord>>(
      "/api/v2/derivative-groups",
    );
    return {
      derivative_groups: response.items || [],
      derivative_group_count: response.count || 0,
    } satisfies DerivativeGroupsResponse;
  },
  createDerivativeGroup: async (payload: CreateDerivativeGroupPayload) => {
    const response = await apiFetch<ApiResponse<DerivativeGroupRecord>>("/api/v2/derivative-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.data) {
      throw new Error("Derivative group create response did not include group data.");
    }
    return response.data;
  },
  deleteDerivativeGroup: (derivativeGroupId: ApiId) =>
    apiFetch<void>(
      `/api/v2/derivative-groups/${encodeId(derivativeGroupId)}`,
      {
        method: "DELETE",
      },
    ),

  getDerivatives: async () => {
    const response =
      await apiFetch<ApiListResponse<DerivativeRecord>>("/api/v2/derivatives");
    return {
      derivatives: response.items || [],
      derivative_count: response.count || 0,
    } satisfies DerivativesResponse;
  },
  getDerivative: async (derivativeId: ApiId) => {
    const response = await apiFetch<ApiResponse<DerivativeRecord>>(
      `/api/v2/derivatives/${encodeId(derivativeId)}`,
    );
    if (!response.data) {
      throw new Error("Derivative response did not include derivative data.");
    }
    return response.data;
  },
  mapDerivatives: async (derivatives: DerivativeMapItem[]) => {
    const response = await apiFetch<DerivativeMapApiResponse>(
      directBackendUrl("/api/v2/derivatives/map"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ derivatives }),
      },
    );
    return {
      data: response.data || null,
      message: response.message,
      success: response.success,
    };
  },
  createDerivatives: async (derivatives: DerivativeCreateRequestItem[]) => {
    const response = await apiFetch<DerivativeCreateResponse>(
      directBackendUrl("/api/v2/derivatives"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ derivatives }),
      },
    );
    return {
      data: response.data || [],
      message: response.message,
      success: response.success,
    };
  },
  patchDerivatives: async (derivatives: DerivativePatchRequestItem[]) => {
    const response = await apiFetch<DerivativePatchResponse>(
      directBackendUrl("/api/v2/derivatives"),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ derivatives }),
      },
    );
    return {
      data: response.data || [],
      message: response.message,
      success: response.success,
    };
  },
  uploadDerivativeBlob: (derivativeId: ApiId, formData: FormData) =>
    apiFetch<DerivativeUploadBlobResponse>(
      directBackendUrl(`/api/v2/derivatives/${encodeId(derivativeId)}/blob`),
      {
        method: "PUT",
        body: formData,
      },
    ),
  deleteDerivatives: (derivativeIds: number[]) =>
    apiFetch<void>("/api/v2/derivatives", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: derivativeIds }),
    }),
  deleteDerivative: (derivativeId: ApiId) =>
    apiFetch<void>(`/api/v2/derivatives/${encodeId(derivativeId)}`, {
      method: "DELETE",
    }),

  getAssets: async () => {
    const response =
      await apiFetch<ApiListResponse<AssetRecord>>("/api/v2/assets");
    return {
      assets: response.items || [],
      asset_count: response.count || 0,
    } satisfies AssetsResponse;
  },
  getAsset: async (assetId: ApiId) => {
    const response = await apiFetch<ApiResponse<AssetRecord>>(
      `/api/v2/assets/${encodeId(assetId)}`,
    );
    if (!response.data) {
      throw new Error("Asset response did not include asset data.");
    }
    return response.data;
  },
  createAsset: async (payload: CreateAssetPayload) => {
    const response = await apiFetch<ApiResponse<AssetRecord>>(
      "/api/v2/assets",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
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
      body: JSON.stringify({ ids: assetIds }),
    }),
  deleteAsset: (assetId: ApiId) =>
    apiFetch<void>(`/api/v2/assets/${encodeId(assetId)}`, {
      method: "DELETE",
    }),
} as const;
