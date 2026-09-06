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

export interface SampleSetRecord {
  sample_set_id: ApiId;
  sample_set_name: string;
  sample_set_description?: string | null;
  status: "draft" | "active";
  created_at?: string;
  sample_ids?: string[];
}

export interface CreateSampleSetPayload {
  sample_set_name: string;
  sample_set_description?: string | null;
  sample_ids: string[];
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
  model_family?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePayloadTemplatePayload {
  payload_template_name: string;
  description?: string | null;
  model_family: string;
  payload_template: Record<string, unknown>;
  resources: Array<{
    name: string;
    table: "artifacts" | "samples";
    batch_limit: number;
    conditions: Array<{
      field: string;
      operator:
        | "equals"
        | "not_equals"
        | "greater_than"
        | "less_than"
        | "contains";
      value_type: "manual" | "sample-field";
      value: string;
    }>;
  }>;
}

export interface SourceRecord {
  asset_id?: number;
  asset_name?: string;
  asset_mime_type?: string | null;
  sample_id?: string;
  sample_name?: string;
  artifact_id?: number;
  artifact_name?: string;
  artifact_group_id?: number | null;
  workflow_id?: number | string;
  workflow_name?: string;
  workflow_step_id?: number;
  step_name?: string;
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

export interface CreateWorkflowStepPayload {
  step_name: string;
  model_family: string;
  model: string;
  payload_template_id: number;
  output_spec_id: number;
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

export interface CreateOutputSpecPayload {
  output_spec_name: string;
  type: "plain-text" | "json";
  item_schema?: Record<string, unknown> | null;
  instructions?: string | null;
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

export function extractSampleSetItems(response) {
  return extractListItems(response);
}

export function extractSourceItems(response) {
  return extractListItems(response);
}

export const resourceCatalogApi = {
  getArtifactGroups: (params?: {
    query?: string;
    mapping_type?: string;
    status?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.mapping_type)
      searchParams.set("mapping_type", params.mapping_type);
    if (params?.status) searchParams.set("status", params.status);
    if (typeof params?.limit === "number")
      searchParams.set("limit", String(params.limit));
    const queryString = searchParams.toString();
    return apiFetch<ArtifactGroupsResponse>(
      `/api/v2/artifact-groups${queryString ? `?${queryString}` : ""}`,
    );
  },
  getSampleSets: (params?: {
    query?: string;
    status?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.status) searchParams.set("status", params.status);
    if (typeof params?.limit === "number")
      searchParams.set("limit", String(params.limit));
    const queryString = searchParams.toString();
    return apiFetch<ApiListResponse<SampleSetRecord>>(
      `/api/v2/sample-sets${queryString ? `?${queryString}` : ""}`,
    );
  },
  getSampleSet: (sampleSetId: ApiId) =>
    apiFetch<ApiResponse<SampleSetRecord>>(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}`,
    ),
  createSampleSet: (payload: CreateSampleSetPayload) =>
    apiFetch<ApiResponse<SampleSetRecord>>("/api/v2/sample-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}`,
      { method: "DELETE" },
    ),
  getArtifactGroup: (artifactGroupId: ApiId) =>
    apiFetch<ApiResponse<ArtifactGroupRecord>>(
      `/api/v2/artifact-groups/${artifactGroupId}`,
    ),
  deleteArtifactGroups: (payload: DeleteArtifactGroupsPayload) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      "/api/v2/artifact-groups",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  createArtifactGroup: (payload: CreateArtifactGroupPayload) =>
    apiFetch<ApiResponse<ArtifactGroupRecord>>("/api/v2/artifact-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getPayloadTemplates: () =>
    apiFetch<
      | ApiListResponse<PayloadTemplateRecord>
      | ApiResponse<PayloadTemplateRecord[]>
    >("/api/v2/payload-templates"),
  createPayloadTemplate: (payload: CreatePayloadTemplatePayload) =>
    apiFetch<ApiResponse<PayloadTemplateRecord>>("/api/v2/payload-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deletePayloadTemplates: (payload: { payload_template_ids: number[] }) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      "/api/v2/payload-templates",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  getWorkflowSteps: () =>
    apiFetch<
      ApiListResponse<WorkflowStepRecord> | ApiResponse<WorkflowStepRecord[]>
    >("/api/v2/workflow-steps"),
  getOutputSpecs: () =>
    apiFetch<
      ApiListResponse<OutputSpecRecord> | ApiResponse<OutputSpecRecord[]>
    >("/api/v2/output-specs"),
  createOutputSpec: (payload: CreateOutputSpecPayload) =>
    apiFetch<ApiResponse<OutputSpecRecord>>("/api/v2/output-specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createWorkflowStep: (payload: CreateWorkflowStepPayload) =>
    apiFetch<ApiResponse<WorkflowStepRecord>>("/api/v2/workflow-steps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteWorkflowStep: (workflowStepId: ApiId) =>
    apiFetch<{ success?: boolean; deleted?: boolean }>(
      `/api/v2/workflow-steps/${encodeURIComponent(String(workflowStepId))}`,
      { method: "DELETE" },
    ),
  getAssets: () => apiFetch<ApiListResponse<SourceRecord>>("/api/v2/assets"),
  getSamples: () => apiFetch<ApiListResponse<SourceRecord>>("/api/v2/samples"),
  getArtifacts: () =>
    apiFetch<ApiListResponse<SourceRecord>>("/api/v2/artifacts"),
} as const;
