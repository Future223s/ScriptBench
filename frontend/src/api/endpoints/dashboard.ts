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

export interface AnalysisRelationship {
  id: string;
  direction: "upstream" | "downstream";
  step_id: number;
  step_name: string;
  count: number;
}

export interface TranscriptionAnalysis {
  id: number;
  sample_id: string;
  sample_name: string;
  sample_set_id: number;
  sample_set_name: string;
  sample_mime_type?: string | null;
  workflow_id: number;
  workflow_name: string;
  workflow_step_id: number;
  workflow_step_name: string;
  text: string;
  ground_truth?: string | null;
  cer?: number | null;
  disagreement_count?: number | null;
  relationships: AnalysisRelationship[];
  assembled_model_payload?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface DisagreementAnalysis {
  id: string;
  source_output_id: number;
  target_output_id: number;
  source_step_id: number;
  source_step_name: string;
  target_step_id: number;
  target_step_name: string;
  target_model?: string | null;
  sample_id: string;
  sample_name: string;
  sample_set_id: number;
  sample_set_name: string;
  workflow_id: number;
  workflow_name: string;
  ground_truth?: string | null;
  source_text: string;
  target_text: string;
  source_line_context: string;
  target_line_context: string;
  source_span_start: number;
  source_span_end: number;
  target_span_start: number;
  target_span_end: number;
  operation_type: "insertion" | "deletion" | "substitution";
  correctness_outcome: "correction" | "regression" | "neutral" | "equivalent" | "unresolved";
}

export interface SampleSetAnalysisResponse {
  transcriptions: TranscriptionAnalysis[];
  disagreements: DisagreementAnalysis[];
  next_cursor: number | null;
  has_more: boolean;
}

export interface AnalysisChunkOptions {
  cursor?: number | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface ComputedDisagreementRegion {
  sequence: number;
  source_start: number;
  source_end: number;
  target_start: number;
  target_end: number;
  source_text: string;
  target_text: string;
  raw_edit_count: number;
  normalized_distance: number;
  operation_type: "insertion" | "deletion" | "substitution";
  correctness_outcome: "correction" | "regression" | "neutral" | "equivalent" | "unresolved";
}

export interface WorkflowComparisonSample {
  sample_id: string;
  sample_name: string;
  source_output_id: number;
  target_output_id: number;
  source_text: string;
  target_text: string;
  regions: ComputedDisagreementRegion[];
}

export interface WorkflowDisagreementComputation {
  sample_set_id: number;
  source_workflow_id: number;
  source_workflow_name: string;
  target_workflow_id: number;
  target_workflow_name: string;
  target_model?: string | null;
  agreement_anchor_length: number;
  severity_threshold: number;
  minimum_raw_edits: number;
  samples: WorkflowComparisonSample[];
  skipped_samples: Array<{
    sample_id: string;
    sample_name: string;
    reason: string;
  }>;
}

export interface FindDisagreementsPayload {
  sample_set_id: number;
  source_workflow_id: number;
  target_workflow_id: number;
  agreement_anchor_length: number;
  severity_threshold: number;
  minimum_raw_edits: number;
}

export interface WorkflowCreatePayload {
  name: string;
  description?: string | null;
  sample_set_id: ApiId;
  status?: "draft";
}

function analysisChunkPath(path: string, options: AnalysisChunkOptions): string {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(options.limit ?? 100));
  if (options.cursor != null) searchParams.set("cursor", String(options.cursor));
  return `${path}?${searchParams.toString()}`;
}

const emptyAnalysisChunk = (): SampleSetAnalysisResponse => ({
  transcriptions: [],
  disagreements: [],
  next_cursor: null,
  has_more: false,
});

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
  getSampleSetAnalysis: async (
    sampleSetId: ApiId,
    options: AnalysisChunkOptions = {},
  ) => {
    const response = await apiFetch<ApiResponse<SampleSetAnalysisResponse>>(
      analysisChunkPath(
        `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}/analysis`,
        options,
      ),
      { signal: options.signal },
    );
    return response.data || emptyAnalysisChunk();
  },
  getGlobalAnalysis: async (options: AnalysisChunkOptions = {}) => {
    const response = await apiFetch<ApiResponse<SampleSetAnalysisResponse>>(
      analysisChunkPath("/api/v2/analysis", options),
      { signal: options.signal },
    );
    return response.data || emptyAnalysisChunk();
  },
  getTranscriptionPayload: async (outputId: ApiId) => {
    const response = await apiFetch<
      ApiResponse<{
        output_id: number;
        assembled_model_payload: Record<string, unknown>;
      }>
    >(`/api/v2/analysis/transcriptions/${encodeURIComponent(String(outputId))}/payload`);
    return response.data?.assembled_model_payload || {};
  },
  findDisagreements: async (payload: FindDisagreementsPayload) => {
    const response = await apiFetch<
      ApiResponse<WorkflowDisagreementComputation>
    >("/api/v2/analysis/disagreements/find", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.data) throw new Error("The comparison returned no data");
    return response.data;
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
