import { apiFetch } from "../client";

export type ApiId = string | number;

export interface ArtifactGroupRecord {
  artifact_group_id: ApiId;
  artifact_group_name: string;
  artifact_group_description?: string | null;
  membership_mapping_id?: number | null;
  sample_mapping_id?: number | null;
  position_rule?: Record<string, unknown> | null;
  mapping_type?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface ArtifactGroupSummaryRecord {
  artifact_group_id: ApiId;
  artifact_group_name: string;
  artifact_group_description?: string | null;
  mapping_type?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface ArtifactGroupsResponse {
  items?: ArtifactGroupSummaryRecord[];
  count?: number;
}

export interface CreateArtifactGroupPayload {
  artifact_group_name: string;
  artifact_group_description?: string | null;
  membership_mapping_id?: number | null;
  sample_mapping_id?: number | null;
  position_rule?: Record<string, unknown> | null;
  mapping_type?: string;
}

export interface PayloadTemplateRecord {
  payload_template_id: number;
  payload_template_name: string;
  version?: number;
  payload_template?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowStepRecord {
  workflow_step_id: number;
  step_name: string;
  version?: number;
  model_family?: string | null;
  model?: string | null;
  payload_template_id?: number | null;
  output_spec_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OutputSpecRecord {
  output_spec_id: number;
  output_spec_name: string;
  version?: number;
  type?: string | null;
  item_schema?: Record<string, unknown> | null;
  instructions?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApiListResponse<T> {
  success?: boolean;
  message?: string;
  items?: T[];
  count?: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T | null;
}

export interface DeleteArtifactGroupsPayload {
  artifact_group_ids: ApiId[];
}

function extractListItems(response) {
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return [];
}

export function extractPayloadTemplateItems(response) {
  return extractListItems(response);
}

export function extractWorkflowStepItems(response) {
  return extractListItems(response);
}

export function extractOutputSpecItems(response) {
  return extractListItems(response);
}

export function extractArtifactGroupItems(response) {
  return extractListItems(response);
}

export const resourceCatalogApi = {
  getArtifactGroups: (params?: { query?: string; mapping_type?: string; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.mapping_type) searchParams.set("mapping_type", params.mapping_type);
    if (params?.status) searchParams.set("status", params.status);
    if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
    const queryString = searchParams.toString();
    return apiFetch<ArtifactGroupsResponse>(`/api/v2/artifact-groups${queryString ? `?${queryString}` : ""}`);
  },
  getArtifactGroup: (artifactGroupId: ApiId) =>
    apiFetch<ApiResponse<ArtifactGroupRecord>>(`/api/v2/artifact-groups/${artifactGroupId}`),
  deleteArtifactGroups: (payload: DeleteArtifactGroupsPayload) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>("/api/v2/artifact-groups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createArtifactGroup: (payload: CreateArtifactGroupPayload) =>
    apiFetch<ApiResponse<ArtifactGroupRecord>>("/api/v2/artifact-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getPayloadTemplates: () => apiFetch<ApiListResponse<PayloadTemplateRecord> | ApiResponse<PayloadTemplateRecord[]>>("/api/v2/payload-templates"),
  getWorkflowSteps: () => apiFetch<ApiListResponse<WorkflowStepRecord> | ApiResponse<WorkflowStepRecord[]>>("/api/v2/workflow-steps"),
  getOutputSpecs: () => apiFetch<ApiListResponse<OutputSpecRecord> | ApiResponse<OutputSpecRecord[]>>("/api/v2/output-specs"),
} as const;
