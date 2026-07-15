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

const EMPTY_WORKFLOW: WorkspaceWorkflowSummary = {
  workflow_id: 0,
  workflow_name: "",
  workflow_stage: "",
  model_family: "",
  model: "",
  sample_set_id: null,
  status: null,
  groups: [],
  updated_at: null,
};

const EMPTY_WORKSPACE: WorkspaceResponse = {
  workflow: EMPTY_WORKFLOW,
  sample_ids: [],
  pending_jobs: [],
  queued_jobs: [],
  completed_jobs: [],
  transcriptions: [],
};

const EMPTY_JOB_DETAIL: WorkspaceJobDetailResponse = {
  job_id: 0,
  workflow_id: null,
  status: null,
  created_at: null,
  started_at: null,
  completed_at: null,
  failure_reason: null,
  raw_content: null,
  sample_ids: [],
  resolved_prompt: null,
  time_elapsed: null,
};

const EMPTY_TRANSCRIPTION_DETAIL: WorkspaceTranscriptionDetailResponse = {
  transcription: {
    transcription_id: 0,
    workflow_id: null,
    job_id: null,
    sample_id: null,
    sample_ids: [],
    group_name: null,
    group_value: null,
    output_name: null,
    transcription_text: null,
    cer: null,
    wer: null,
    hallucinations: null,
    line_omission_count: null,
    line_addition_count: null,
    created_at: null,
    updated_at: null,
    status: null,
    metrics: null,
  },
  ground_truth_text: "",
  sample_ids: [],
};

export const workspaceApi = {
  getWorkspaceEventsUrl: () => "",
  getWorkflows: async () => ({ workflows: [], workflow_count: 0 } satisfies WorkflowsResponse),
  markWorkspaceOpened: async () => undefined,
  getWorkspace: async (workflowId: ApiId) => ({
    ...EMPTY_WORKSPACE,
    workflow: {
      ...EMPTY_WORKFLOW,
      workflow_id: workflowId,
    },
  }),
  createWorkspaceJobs: async () => ({ message: "Legacy workspace endpoint removed." }),
  queueWorkspaceJobs: async () => undefined,
  retryWorkspaceJobs: async () => undefined,
  deleteWorkspaceJobs: async () => undefined,
  getWorkspaceJob: async (workflowId: ApiId, jobId: ApiId) => ({
    ...EMPTY_JOB_DETAIL,
    workflow_id: workflowId,
    job_id: jobId,
  }),
  createWorkspaceTranscriptions: async () => ({ message: "Legacy workspace endpoint removed." }),
  getWorkspaceTranscription: async (workflowId: ApiId, transcriptionId: ApiId) => ({
    ...EMPTY_TRANSCRIPTION_DETAIL,
    transcription: {
      ...EMPTY_TRANSCRIPTION_DETAIL.transcription,
      workflow_id: workflowId,
      transcription_id: transcriptionId,
    },
  }),
  scoreWorkspace: async () => undefined,
} as const;
