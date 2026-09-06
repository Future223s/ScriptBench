import { apiFetch } from "../client";

export type ApiId = string | number;

export interface SampleSetSummary {
  sample_set_id: ApiId;
  sample_set_name: string;
  sample_set_description?: string | null;
  status?: string | null;
  created_at?: string;
  sample_ids?: string[];
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

export interface WorkflowRecord {
  workflow_id: number;
  workflow_name: string;
  workflow_description?: string | null;
  sample_set_id?: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDagNodeRecord {
  workflow_dag_node_id: number;
  workflow_id: number;
  workflow_step_id: number;
  row: number;
  col: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDagEdgeRecord {
  workflow_dag_edge_id: number;
  workflow_id: number;
  from_workflow_dag_node_id: number;
  to_workflow_dag_node_id: number;
  edge_condition: Record<string, unknown> | string | null;
  created_at: string;
}

export interface WorkflowStepRecord {
  workflow_step_id: number;
  step_name: string;
  model_family: string;
  model?: string | null;
  payload_template_id?: number | null;
  output_spec_id?: number | null;
  created_at: string;
  status: string;
}

export interface WorkflowDagNodeCreatePayload {
  workflow_step_id: number;
  row: number;
  col: number;
}

export interface WorkflowDagEdgeCreatePayload {
  from_workflow_dag_node_id: number;
  to_workflow_dag_node_id: number;
  edge_condition?: Record<string, unknown> | string;
}

export const workflowBuilderApi = {
  getSampleSets: () =>
    apiFetch<ApiListResponse<SampleSetSummary>>("/api/v2/sample-sets"),
  getWorkflows: () =>
    apiFetch<ApiListResponse<WorkflowRecord>>("/api/v2/workflows"),
  createWorkflow: (payload: {
    workflow_name: string;
    workflow_description?: string | null;
    sample_set_id: ApiId;
    status?: string;
  }) =>
    apiFetch<ApiResponse<WorkflowRecord>>("/api/v2/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  saveWorkflow: (
    workflowId: ApiId,
    payload: {
      workflow_name?: string;
      workflow_description?: string | null;
      sample_set_id?: ApiId;
    },
  ) =>
    apiFetch<ApiResponse<WorkflowRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  finalizeWorkflow: (workflowId: ApiId) =>
    apiFetch<ApiResponse<WorkflowRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/finalize`,
      {
        method: "PATCH",
      },
    ),
  getWorkflow: (workflowId: ApiId) =>
    apiFetch<ApiResponse<WorkflowRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}`,
    ),
  getWorkflowDagNodes: (workflowId: ApiId) =>
    apiFetch<ApiListResponse<WorkflowDagNodeRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`,
    ),
  getWorkflowDagEdges: (workflowId: ApiId) =>
    apiFetch<ApiListResponse<WorkflowDagEdgeRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`,
    ),
  createWorkflowDagNode: (
    workflowId: ApiId,
    payload: WorkflowDagNodeCreatePayload,
  ) =>
    apiFetch<ApiResponse<WorkflowDagNodeRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  deleteWorkflowDagNode: (workflowId: ApiId, nodeIds: number[]) =>
    apiFetch<ApiDeleteResponse>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-nodes`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow_dag_node_ids: nodeIds }),
      },
    ),
  createWorkflowDagEdge: (
    workflowId: ApiId,
    payload: WorkflowDagEdgeCreatePayload,
  ) =>
    apiFetch<ApiResponse<WorkflowDagEdgeRecord>>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  deleteWorkflowDagEdge: (workflowId: ApiId, edgeId: number) =>
    apiFetch<ApiDeleteResponse>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}/workflow-dag-edges`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow_dag_edge_id: edgeId }),
      },
    ),
  getWorkflowSteps: () =>
    apiFetch<ApiListResponse<WorkflowStepRecord>>("/api/v2/workflow-steps"),
} as const;
