import { apiFetch } from "../client";

export type ApiId = string | number;

export interface SampleRecord {
  sample_id: string;
  sample_group?: string | null;
  sample_groups?: Record<string, unknown>;
  sample_mime_type?: string | null;
  ground_truth_text?: string | null;
  created_at?: string;
  updated_at?: string;
  has_sample_blob?: boolean;
  sample_blob_size?: number;
  sample_blob_base64?: string | null;
}

export interface GroupingRecord {
  name: string;
  source: string;
  assignments: Record<string, unknown>;
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

export interface SamplesResponse {
  samples: SampleRecord[];
  sample_count: number;
}

export interface GroupingsResponse {
  groupings: GroupingRecord[];
  grouping_count: number;
}

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export const fileManagementApi = {
  getSamples: () => apiFetch<SamplesResponse>("/api/v1/samples"),
  getGroupings: () => apiFetch<GroupingsResponse>("/api/v1/groupings"),
  getSampleSets: () => apiFetch<SampleSetsResponse>("/api/v1/sample-sets"),
  getSample: (sampleId: ApiId) =>
    apiFetch<SampleRecord>(`/api/v1/samples/${encodeURIComponent(String(sampleId))}`),
  createSample: (formData: FormData) =>
    apiFetch<SampleRecord>("/api/v1/samples", {
      method: "POST",
      body: formData,
    }),
  createGrouping: (payload: { name: string; sample_ids: string[] }) =>
    apiFetch<GroupingRecord>("/api/v1/groupings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createGroupingValue: (groupName: string, payload: { value: string; sample_ids: string[] }) =>
    apiFetch<GroupingRecord>(`/api/v1/groupings/${encodeURIComponent(String(groupName))}/values`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createSampleSet: (payload: {
    name: string;
    type: string;
    description?: string | null;
    sample_ids: string[];
  }) =>
    apiFetch<SampleSetSummary>("/api/v1/sample-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSample: (sampleId: ApiId) =>
    apiFetch<{ sample_id: ApiId; deleted: true }>(`/api/v1/samples/${encodeURIComponent(String(sampleId))}`, {
      method: "DELETE",
    }),
  deleteGrouping: (groupName: string) =>
    apiFetch<{ group_name: string; deleted: true; updated_samples: number }>(
      `/api/v1/groupings/${encodeURIComponent(String(groupName))}`,
      {
        method: "DELETE",
      },
    ),
} as const;
