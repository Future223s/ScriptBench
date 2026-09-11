import { apiFetch } from "../client";

export type ApiId = string | number;

export interface SampleSetSummary {
  id: ApiId;
  name: string;
  description?: string | null;
  sample_count?: number;
  completed_sample_count?: number;
  workflow_count?: number;
  sample_ids?: string[];
  sample_ids_preview?: string[];
  status?: string | null;
  created_at?: string;
}

export interface MetricSummary {
  min?: number | null;
  q1?: number | null;
  median?: number | null;
  q3?: number | null;
  max?: number | null;
  mean?: number | null;
  stddev?: number | null;
}

export interface WorkflowSummary {
  id: ApiId;
  name: string;
  description: string | null;
  sample_set_id: ApiId;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SampleSetsResponse {
  sample_sets: SampleSetSummary[];
  sample_set_count: number;
}

export interface ApiListResponse<T> {
  success?: boolean;
  message?: string;
  items?: T[];
  count?: number;
}

export interface SampleSetAnalyticsResponse {
  sample_set: SampleSetSummary | null;
  sample_ids: string[];
  workflows: WorkflowSummary[];
  workflow_count?: number;
  sample_count?: number;
  analytics_by_workflow?: Record<
    string,
    {
      completed_sample_count: number;
      metrics: {
        cer?: MetricSummary | null;
        wer?: MetricSummary | null;
        hallucinations?: MetricSummary | null;
      };
    }
  >;
  metrics?: {
    cer?: MetricSummary | null;
    wer?: MetricSummary | null;
    hallucinations?: MetricSummary | null;
  };
}

export interface DeleteSampleSetResponse {
  success: boolean;
  message: string;
  deleted: true;
}

export interface DeleteWorkflowResponse {
  success: boolean;
  message: string;
  deleted: true;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface WorkflowCreatePayload {
  name: string;
  description?: string | null;
  sample_set_id: ApiId;
  status?: "draft";
}

export const dashboardApi = {
  getSampleSets: async () => {
    const response = await apiFetch<ApiListResponse<SampleSetSummary>>(
      "/api/v2/sample-sets",
    );
    return {
      sample_sets: response.items || [],
      sample_set_count: response.count || 0,
    } satisfies SampleSetsResponse;
  },
  getSampleSetAnalytics: async (sampleSetId: ApiId) => {
    const response = await apiFetch<
      ApiResponse<SampleSetAnalyticsResponse | null>
    >(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}/analytics`,
    );
    const data = response.data;
    return {
      sample_set: data?.sample_set ?? null,
      sample_ids: Array.isArray(data?.sample_ids) ? data.sample_ids : [],
      workflows: Array.isArray(data?.workflows) ? data.workflows : [],
      workflow_count:
        typeof data?.workflow_count === "number"
          ? data.workflow_count
          : undefined,
      sample_count:
        typeof data?.sample_count === "number" ? data.sample_count : undefined,
      analytics_by_workflow: data?.analytics_by_workflow ?? {},
      metrics: data?.metrics ?? {},
    };
  },
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<DeleteSampleSetResponse>(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}`,
      {
        method: "DELETE",
      },
    ),
  deleteWorkflow: (workflowId: ApiId) =>
    apiFetch<DeleteWorkflowResponse>(
      `/api/v2/workflows/${encodeURIComponent(String(workflowId))}`,
      {
        method: "DELETE",
      },
    ),
  createWorkflow: (payload: WorkflowCreatePayload) =>
    apiFetch("/api/v2/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
} as const;
