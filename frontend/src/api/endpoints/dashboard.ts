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

export interface MetricSummary {
  min?: number | null;
  median?: number | null;
  max?: number | null;
  mean?: number | null;
  stddev?: number | null;
}

export interface WorkflowSummary {
  workflow_id: ApiId;
  workflow_name?: string | null;
  workflow_stage?: string | null;
  model_family?: string | null;
  model?: string | null;
  groups?: string[] | null;
  sample_set_id?: ApiId | null;
}

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export interface SampleSetAnalyticsResponse {
  sample_set: SampleSetSummary | null;
  sample_ids: string[];
  workflows: WorkflowSummary[];
  workflow_count?: number;
  sample_count?: number;
  metrics: {
    cer?: MetricSummary | null;
    wer?: MetricSummary | null;
    hallucinations?: MetricSummary | null;
  };
}

export interface DeleteSampleSetResponse {
  sample_set_id: ApiId;
  deleted: true;
}

export interface DeleteWorkflowResponse {
  workflow_id: ApiId;
  deleted: true;
}

export interface WorkflowCreatePromptExample {
  title: string;
  instruction_text: string;
  assets: string[];
}

export interface WorkflowCreatePromptInputs {
  sample_ids: string[];
  selection_mode: "single" | "batch";
  batch_size: number;
}

export interface WorkflowCreatePromptOutputFormat {
  type: string;
  item_schema: Record<string, string> | null;
}

export interface WorkflowCreatePromptSpec {
  instructions: string;
  examples: WorkflowCreatePromptExample[];
  inputs: WorkflowCreatePromptInputs;
  output_format: WorkflowCreatePromptOutputFormat;
}

export interface WorkflowCreatePayload {
  workflow_name: string;
  workflow_stage: string;
  sample_set_id: ApiId;
  model_family: string;
  model?: string | null;
  groups?: string[];
  prompt_spec: WorkflowCreatePromptSpec;
  status?: string;
}

export const dashboardApi = {
  getSampleSets: () => apiFetch<SampleSetsResponse>("/api/v1/sample-sets"),
  getSampleSetAnalytics: (sampleSetId: ApiId) =>
    apiFetch<SampleSetAnalyticsResponse>(`/api/v1/sample-sets/${encodeURIComponent(String(sampleSetId))}/analytics`),
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<DeleteSampleSetResponse>(`/api/v1/sample-sets/${encodeURIComponent(String(sampleSetId))}`, {
      method: "DELETE",
    }),
  deleteWorkflow: (workflowId: ApiId) =>
    apiFetch<DeleteWorkflowResponse>(`/api/v1/workflows/${encodeURIComponent(String(workflowId))}`, {
      method: "DELETE",
    }),
  createWorkflow: (payload: WorkflowCreatePayload) =>
    apiFetch("/api/v1/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
} as const;
