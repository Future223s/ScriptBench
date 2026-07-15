import { apiFetch } from "../client";

export type ApiId = string | number;

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

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export interface WorkflowCreatePayload {
  workflow_name: string;
  workflow_stage: string;
  sample_set_id: ApiId;
  model_family: string;
  model?: string | null;
  groups?: string[];
  prompt_spec: Record<string, unknown>;
  status?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface ApiListResponse<T> {
  success: boolean;
  message: string;
  items: T[];
  count: number;
}

export interface ApiDeleteResponse {
  success: boolean;
  message: string;
  deleted: boolean;
}

export const workflowBuilderApi = {
  getSampleSets: () => apiFetch<SampleSetsResponse>("/api/v2/sample-sets"),
  createWorkflow: (payload: WorkflowCreatePayload) =>
    apiFetch<ApiResponse<Record<string, unknown>>>("/api/v2/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getWorkflow: (workflowId: ApiId) =>
    apiFetch<ApiResponse<Record<string, unknown>>>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}`),
  getWorkflowDagNodes: (workflowId: ApiId) =>
    apiFetch<ApiResponse<Record<string, unknown>>>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`),
  getWorkflowDagEdges: (workflowId: ApiId) =>
    apiFetch<ApiResponse<Record<string, unknown>>>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`),
  createWorkflowDagNode: (workflowId: ApiId) =>
    apiFetch<ApiResponse<Record<string, unknown>>>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`, {
      method: "POST",
    }),
  deleteWorkflowDagNode: (workflowId: ApiId) =>
    apiFetch<ApiDeleteResponse>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`, {
      method: "DELETE",
    }),
  createWorkflowDagEdge: (workflowId: ApiId) =>
    apiFetch<ApiResponse<Record<string, unknown>>>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`, {
      method: "POST",
    }),
  deleteWorkflowDagEdge: (workflowId: ApiId) =>
    apiFetch<ApiDeleteResponse>(`/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`, {
      method: "DELETE",
    }),
  getWorkflowSteps: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/workflow-steps"),
  createWorkflowStep: () =>
    apiFetch<ApiResponse<Record<string, unknown>>>("/api/v2/workflow-steps", {
      method: "POST",
    }),
  listWorkflowSteps: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/workflow-steps"),
  getPayloadTemplates: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/payload-templates"),
  createPayloadTemplate: () =>
    apiFetch<ApiResponse<Record<string, unknown>>>("/api/v2/payload-templates", {
      method: "POST",
    }),
  listPayloadTemplates: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/payload-templates"),
  getOutputSpecs: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/output-specs"),
  createOutputSpec: () =>
    apiFetch<ApiResponse<Record<string, unknown>>>("/api/v2/output-specs", {
      method: "POST",
    }),
  listOutputSpecs: () => apiFetch<ApiListResponse<Record<string, unknown>>>("/api/v2/output-specs"),
} as const;
