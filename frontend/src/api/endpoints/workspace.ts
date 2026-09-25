import { apiFetch } from "../client";
export type ApiId = string | number;
export interface WorkflowSummary {
  id: ApiId;
  name?: string | null;
  sample_set_id?: ApiId | null;
  description?: string | null;
  status?: string | null;
  execution_mode?: "continuous" | "stage_by_stage" | null;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface ExecutionJob {
  id: ApiId;
  workflow_id: ApiId;
  sample_id?: string | null;
  target_label?: string | null;
  entity_ids?: string[];
  output_entity_ids?: string[];
  execution_scope?: string;
  output_scope?: string;
  status?: "blocked" | "pending" | "queued" | "running" | "completed" | string;
  current_workflow_dag_node_id?: ApiId | null;
  next_step_name?: string | null;
  error_message?: string | null;
  raw_payload?: unknown;
}
export interface ResolvedExecutionNode {
  workflow_run_node_id: number;
  workflow_dag_node_id: number;
  workflow_step_id: number;
  step_name: string;
  execution_scope: string;
  output_scope: string;
  topological_depth: number;
  row: number;
  col: number;
  released: boolean;
  blocked: number;
  pending: number;
  queued: number;
  running: number;
  completed: number;
  total: number;
}
export interface ResolvedExecutionGraph {
  run: Record<string, unknown> | null;
  nodes: ResolvedExecutionNode[];
  edges: Array<{
    id: number;
    from_workflow_dag_node_id: number;
    to_workflow_dag_node_id: number;
  }>;
}
export interface ExecutionJobDetail extends ExecutionJob {
  workflow_steps: import("./workflowSteps").WorkflowStepRecord[];
  step_outputs: StepOutputRecord[];
  raw_outputs: RawOutputRecord[];
  step_output_dependencies: StepOutputDependency[];
}
export interface StepOutputDependency {
  workflow_step_id: number;
  source_workflow_step_id: number;
}
export interface ExecutionControlResponse {
  message?: string;
  data?: {
    workflow_id?: ApiId;
    queued_count?: number;
    dequeued_count?: number;
  };
}
const path = (id: ApiId) => encodeURIComponent(String(id));
const body = (ids: ApiId[]) => JSON.stringify({ ids: ids });
export const workspaceApi = {
  getWorkflows: async () => {
    const r = await apiFetch<{ items?: WorkflowSummary[] }>(
      "/api/v2/workflows",
    );
    return { workflows: r.items || [] };
  },
  getExecutionJobs: async (workflowId: ApiId, nodeId?: ApiId | null) => {
    const r = await apiFetch<{ items: ExecutionJob[] }>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs${nodeId ? `?workflow_dag_node_id=${path(nodeId)}` : ""}`,
    );
    return r.items;
  },
  getExecutionGraph: async (workflowId: ApiId) => {
    const r = await apiFetch<{ data: ResolvedExecutionGraph }>(
      `/api/v2/workflows/${path(workflowId)}/execution-graph`,
    );
    return r.data;
  },
  queueExecutionNode: (workflowId: ApiId, nodeId: ApiId) =>
    apiFetch<ExecutionControlResponse>(
      `/api/v2/workflows/${path(workflowId)}/execution-nodes/${path(nodeId)}/queue`,
      { method: "POST" },
    ),
  setExecutionNodeRelease: (
    workflowId: ApiId,
    nodeId: ApiId,
    released: boolean,
  ) =>
    apiFetch<ExecutionControlResponse>(
      `/api/v2/workflows/${path(workflowId)}/execution-nodes/${path(nodeId)}/${released ? "release" : "hold"}`,
      { method: "POST" },
    ),
  queueExecutionJobs: (workflowId: ApiId, ids: ApiId[]) =>
    apiFetch<ExecutionControlResponse>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs/queue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(ids),
      },
    ),
  dequeueExecutionJobs: (workflowId: ApiId, ids: ApiId[]) =>
    apiFetch<ExecutionControlResponse>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs/dequeue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(ids),
      },
    ),
  retryCompletedExecutionJobs: (workflowId: ApiId, ids: ApiId[]) =>
    apiFetch<ExecutionControlResponse>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs/retry`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body(ids),
      },
    ),
  acknowledgeFailure: (
    workflowId: ApiId,
    executionJobId: ApiId,
    action: "retry" | "skip" | "abort",
  ) =>
    apiFetch(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs/${path(executionJobId)}/failure-acknowledgement`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      },
    ),
  startExecution: (workflowId: ApiId) =>
    apiFetch(`/api/v2/workflows/${path(workflowId)}/execute`, {
      method: "POST",
    }),
  stopExecution: (workflowId: ApiId) =>
    apiFetch(`/api/v2/workflows/${path(workflowId)}/stop`, { method: "POST" }),
  getExecutionJobDetail: async (workflowId: ApiId, id: ApiId) => {
    const r = await apiFetch<{ data: ExecutionJobDetail }>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs/${path(id)}`,
    );
    return r.data;
  },
  getExecutionJobsEventsUrl: (workflowId: ApiId, executionJobId?: ApiId) => {
    if (typeof window === "undefined") return "";
    const b = (
      process.env.NEXT_PUBLIC_API_WS_BASE_URL || window.location.origin
    )
      .replace(/^http/, "ws")
      .replace(/\/$/, "");
    return `${b}/api/v2/workflows/${path(workflowId)}/execution-jobs/events${executionJobId ? `?execution_job_id=${path(executionJobId)}` : ""}`;
  },
};

export interface StepOutputRecord {
  id: number;
  raw_output_id: number;
  execution_job_id: number;
  workflow_id: number;
  workflow_step_id: number;
  sample_id: string | null;
  output_scope: string;
  entity_type: "document" | "sample" | "derivative";
  entity_key: string;
  output: unknown;
  cer: number | null;
  wer: number | null;
  hallucination_count: number | null;
  created_at: string;
}

export interface RawOutputRecord {
  id: number;
  execution_job_id: number;
  workflow_id: number;
  workflow_step_id: number;
  attempt_no: number;
  assembled_model_payload: Record<string, unknown>;
  raw_model_response: string;
  parsed_output: unknown;
  raw_individual_outputs: unknown;
  complete_output: unknown;
  parse_status: "success" | "failed";
  parse_error: string | null;
  time_elapsed: number;
  started_at: string;
  completed_at: string;
  created_at: string;
}
