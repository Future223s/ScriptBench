import { apiFetch } from "../client";
export type ApiId = string | number;
export interface WorkflowSummary {
  workflow_id: ApiId;
  workflow_name?: string | null;
  sample_set_id?: ApiId | null;
  sample_set_name?: string | null;
  workflow_description?: string | null;
  status?: string | null;
}
export interface ExecutionJob {
  execution_job_id: ApiId;
  workflow_id: ApiId;
  sample_id: string;
  execution_scope?: string;
  status?: "pending" | "queued" | "running" | "completed" | "failed" | string;
  current_workflow_dag_node_id?: ApiId | null;
  next_step_name?: string | null;
  error_message?: string | null;
  raw_payload?: unknown;
}
export interface ExecutionJobDetail extends ExecutionJob {
  step_output?: unknown;
  workflow_steps?: unknown[];
  model_outputs?: unknown[];
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
const body = (ids: ApiId[]) => JSON.stringify({ execution_job_ids: ids });
export const workspaceApi = {
  getWorkflows: async () => {
    const r = await apiFetch<{ items?: WorkflowSummary[] }>(
      "/api/v2/workflows",
    );
    return { workflows: r.items || [] };
  },
  getExecutionJobs: async (workflowId: ApiId) => {
    const r = await apiFetch<{ items: ExecutionJob[] }>(
      `/api/v2/workflows/${path(workflowId)}/execution-jobs`,
    );
    return r.items;
  },
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
    action: "retry" | "stop_execution",
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
