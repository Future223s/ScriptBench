import { apiFetch } from "../client";
export type ApiId = string | number;
export interface WorkflowSummary {
  id: ApiId;
  name?: string | null;
  sample_set_id?: ApiId | null;
  description?: string | null;
  status?: string | null;
}
export interface ExecutionJob {
  id: ApiId;
  workflow_id: ApiId;
  sample_id: string;
  status?: "pending" | "queued" | "running" | "completed" | "failed" | string;
  current_workflow_dag_node_id?: ApiId | null;
  next_step_name?: string | null;
  error_message?: string | null;
  raw_payload?: unknown;
}
export interface ExecutionJobDetail extends ExecutionJob {
  workflow_steps: import("./workflowSteps").WorkflowStepRecord[];
  step_outputs: StepOutputRecord[];
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

export interface StepOutputRecord {
  id: number;
  execution_job_id: number;
  workflow_id: number;
  workflow_step_id: number;
  sample_id: string;
  attempt_no: number;
  assembled_model_payload: Record<string, unknown>;
  raw_model_response: string;
  parsed_output: unknown;
  parse_status: "success" | "failed" | null;
  parse_error: string | null;
  cer: number | null;
  wer: number | null;
  hallucination_count: number | null;
  time_elapsed: number;
  started_at: string;
  completed_at: string;
  created_at: string;
}
