import { apiFetch } from "../client";

export type ApiId = string | number;

export interface WorkspaceWorkflowSummary {
  workflow_id: ApiId;
  workflow_name?: string | null;
  workflow_stage?: string | null;
  model_family?: string | null;
  model?: string | null;
  sample_set_id?: ApiId | null;
  status?: string | null;
  groups?: string[] | null;
  updated_at?: string | null;
}

export interface WorkspaceJobSummary {
  job_id: ApiId;
  workflow_id?: ApiId | null;
  status?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failure_reason?: string | null;
  raw_content?: string | null;
  sample_ids?: string[];
  time_elapsed?: number | null;
}

export interface WorkspaceTranscriptionSummary {
  transcription_id: ApiId;
  workflow_id?: ApiId | null;
  job_id?: ApiId | null;
  sample_id?: string | null;
  sample_ids?: string[];
  group_name?: string | null;
  group_value?: string | null;
  output_name?: string | null;
  transcription_text?: string | null;
  cer?: number | null;
  wer?: number | null;
  hallucinations?: number | null;
  line_omission_count?: number | null;
  line_addition_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  metrics?: Record<string, unknown> | null;
}

export interface WorkflowsResponse {
  workflows: WorkspaceWorkflowSummary[];
  workflow_count: number;
}

export interface WorkspaceResponse {
  workflow: WorkspaceWorkflowSummary;
  sample_ids: string[];
  pending_jobs: WorkspaceJobSummary[];
  queued_jobs: WorkspaceJobSummary[];
  completed_jobs: WorkspaceJobSummary[];
  transcriptions: WorkspaceTranscriptionSummary[];
}

export interface WorkspaceJobDetailResponse {
  job_id: ApiId;
  workflow_id?: ApiId | null;
  status?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failure_reason?: string | null;
  raw_content?: string | null;
  sample_ids?: string[];
  resolved_prompt?: unknown;
  time_elapsed?: number | null;
}

export interface WorkspaceTranscriptionDetailResponse {
  transcription: WorkspaceTranscriptionSummary;
  ground_truth_text: string;
  sample_ids: string[];
}

export const workspaceApi = {
  getWorkspaceEventsUrl: () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_WS_BASE_URL || "http://127.0.0.1:8000";
    const url = new URL(baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return new URL("/api/v1/events", url).toString();
  },
  getWorkflows: () => apiFetch<WorkflowsResponse>("/api/v1/workflows"),
  markWorkspaceOpened: (workflowId: ApiId, workflowStage: string) =>
    apiFetch(`/api/workspaces/${encodeURIComponent(String(workflowId))}/opened?workflow_stage=${encodeURIComponent(workflowStage)}`, {
      method: "POST",
    }),
  getWorkspace: (workflowId: ApiId) =>
    apiFetch<WorkspaceResponse>(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace`),
  createWorkspaceJobs: (workflowId: ApiId) =>
    apiFetch(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace/jobs`, {
      method: "POST",
    }),
  queueWorkspaceJobs: (workflowId: ApiId, jobIds: Array<string | number> = []) =>
    apiFetch(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace/jobs/queue`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_ids: jobIds.length ? jobIds : null }),
    }),
  retryWorkspaceJobs: (workflowId: ApiId, jobIds: Array<string | number> = []) =>
    apiFetch(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace/jobs/retry`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_ids: jobIds.length ? jobIds : null }),
    }),
  deleteWorkspaceJobs: (workflowId: ApiId, kind = "all") =>
    apiFetch(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace/jobs?kind=${encodeURIComponent(kind)}`, {
      method: "DELETE",
    }),
  getWorkspaceJob: (workflowId: ApiId, jobId: ApiId) =>
    apiFetch<WorkspaceJobDetailResponse>(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}/workspace/jobs/${encodeURIComponent(String(jobId))}`),
  createWorkspaceTranscriptions: (workflowId: ApiId) =>
    apiFetch(`/api/v0/workflows/${encodeURIComponent(String(workflowId))}/workspace/transcriptions`, {
      method: "POST",
    }),
  getWorkspaceTranscription: (workflowId: ApiId, transcriptionId: ApiId) =>
    apiFetch<WorkspaceTranscriptionDetailResponse>(
      `/api/v0/workflows/${encodeURIComponent(String(workflowId))}/workspace/transcriptions/${encodeURIComponent(String(transcriptionId))}`,
    ),
  scoreWorkspace: (workflowId: ApiId) =>
    apiFetch(`/api/v0/workflows/${encodeURIComponent(String(workflowId))}/workspace/score`, {
      method: "POST",
    }),
} as const;
