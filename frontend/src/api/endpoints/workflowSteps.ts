import { apiFetch } from "../client";

export type ApiId = string | number;

export interface DerivativeGroupRecord {
  id: ApiId;
  name: string;
  description?: string | null;
  position_rule?: Record<string, unknown> | null;
  mapping_type?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface DerivativeGroupSummaryRecord {
  id: ApiId;
  name: string;
  description?: string | null;
  mapping_type?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface DerivativeGroupsResponse {
  items?: DerivativeGroupSummaryRecord[];
  count?: number;
}

export interface SampleSetRecord {
  id: ApiId;
  name: string;
  description?: string | null;
  status: "draft" | "active";
  created_at?: string;
  sample_ids?: string[];
}

export interface CreateSampleSetPayload {
  name: string;
  description?: string | null;
  sample_ids: string[];
}

export interface CreateDerivativeGroupPayload {
  name: string;
  description?: string | null;
  position_rule?: Record<string, unknown> | null;
  mapping_type?: string;
}

export interface PayloadTemplateRecord {
  id: number;
  name: string;
  payload: Record<string, unknown>;
  resources: PromptResourceRecord[];
  status: "draft" | "active";
  model_family?: string | null;
  created_at?: string;
}

export interface CreatePayloadTemplatePayload {
  name: string;
  model_family: string;
  payload: Record<string, unknown>;
  resources: Array<{
    name: string;
    source_table: "derivatives" | "samples" | "step_outputs";
    batch_limit: number;
    conditions: Array<{
      field_name: string;
      operator:
        | "equals"
        | "not_equals"
        | "greater_than"
        | "less_than"
        | "contains";
      value_type: "manual" | "sample-field";
      value: string;
    }>;
  }>;
}

export interface SourceRecord {
  id: ApiId;
  name: string;
  mime_type?: string | null;
  derivative_group_id?: number | null;
}

export interface WorkflowStepRecord {
  id: number;
  name: string;
  step_executor_id: string;
  method: string;
  executor_config: Record<string, unknown>;
  status: "draft" | "active";
  payload_template_id?: number | null;
  output_spec_id?: number | null;
  created_at?: string;
}

export interface CreateWorkflowStepPayload {
  name: string;
  step_executor_id: string;
  method: string;
  executor_config: Record<string, unknown>;
  payload_template_id: number;
  output_spec_id: number;
}

export interface StepExecutorSummary {
  id: string;
  name: string;
  description: string;
}

export interface StepExecutorMethod {
  name: string;
  label: string;
  description: string;
}

export interface StepExecutorRecord extends StepExecutorSummary {
  config_schema: Record<string, unknown>;
  methods: StepExecutorMethod[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutputSpecRecord {
  id: number;
  name: string;
  type?: string | null;
  item_schema?: Record<string, unknown> | null;
  instructions?: string | null;
  status: "draft" | "active";
  created_at?: string;
}

export interface CreateOutputSpecPayload {
  name: string;
  type: "plain-text" | "json";
  item_schema?: Record<string, unknown> | null;
  instructions?: string | null;
}

export interface ApiListResponse<T> {
  success?: boolean;
  message?: string;
  items?: T[];
  count?: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T | null;
}

export interface DeleteDerivativeGroupsPayload {
  ids: ApiId[];
}

function extractListItems<T>(response: ApiListResponse<T>): T[] {
  return response.items || [];
}

export function extractPayloadTemplateItems(response) {
  return extractListItems(response);
}

export function extractWorkflowStepItems(response) {
  return extractListItems(response);
}

export function extractOutputSpecItems(response) {
  return extractListItems(response);
}

export function extractDerivativeGroupItems(response) {
  return extractListItems(response);
}

export function extractSampleSetItems(response) {
  return extractListItems(response);
}

export function extractSourceItems(response) {
  return extractListItems(response);
}

export const workflowStepsApi = {
  getDerivativeGroups: (params?: {
    query?: string;
    mapping_type?: string;
    status?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.mapping_type)
      searchParams.set("mapping_type", params.mapping_type);
    if (params?.status) searchParams.set("status", params.status);
    if (typeof params?.limit === "number")
      searchParams.set("limit", String(params.limit));
    const queryString = searchParams.toString();
    return apiFetch<DerivativeGroupsResponse>(
      `/api/v2/derivative-groups${queryString ? `?${queryString}` : ""}`,
    );
  },
  getSampleSets: (params?: {
    query?: string;
    status?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set("query", params.query);
    if (params?.status) searchParams.set("status", params.status);
    if (typeof params?.limit === "number")
      searchParams.set("limit", String(params.limit));
    const queryString = searchParams.toString();
    return apiFetch<ApiListResponse<SampleSetRecord>>(
      `/api/v2/sample-sets${queryString ? `?${queryString}` : ""}`,
    );
  },
  getSampleSet: (sampleSetId: ApiId) =>
    apiFetch<ApiResponse<SampleSetRecord>>(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}`,
    ),
  createSampleSet: (payload: CreateSampleSetPayload) =>
    apiFetch<ApiResponse<SampleSetRecord>>("/api/v2/sample-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteSampleSet: (sampleSetId: ApiId) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      `/api/v2/sample-sets/${encodeURIComponent(String(sampleSetId))}`,
      { method: "DELETE" },
    ),
  getDerivativeGroup: (derivativeGroupId: ApiId) =>
    apiFetch<ApiResponse<DerivativeGroupRecord>>(
      `/api/v2/derivative-groups/${derivativeGroupId}`,
    ),
  deleteDerivativeGroups: (payload: DeleteDerivativeGroupsPayload) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      "/api/v2/derivative-groups",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  createDerivativeGroup: (payload: CreateDerivativeGroupPayload) =>
    apiFetch<ApiResponse<DerivativeGroupRecord>>("/api/v2/derivative-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getPayloadTemplates: () =>
    apiFetch<
      ApiListResponse<PayloadTemplateRecord>
    >("/api/v2/payload-templates"),
  createPayloadTemplate: (payload: CreatePayloadTemplatePayload) =>
    apiFetch<ApiResponse<PayloadTemplateRecord>>("/api/v2/payload-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deletePayloadTemplates: (payload: { ids: number[] }) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      "/api/v2/payload-templates",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  getStepExecutors: () =>
    apiFetch<ApiListResponse<StepExecutorSummary>>("/api/v2/step-executors"),
  getStepExecutor: (id: string) =>
    apiFetch<ApiResponse<StepExecutorRecord>>(
      `/api/v2/step-executors/${encodeURIComponent(id)}`,
    ),
  getWorkflowSteps: () =>
    apiFetch<
      ApiListResponse<WorkflowStepRecord>
    >("/api/v2/workflow-steps"),
  getOutputSpecs: () =>
    apiFetch<
      ApiListResponse<OutputSpecRecord>
    >("/api/v2/output-specs"),
  createOutputSpec: (payload: CreateOutputSpecPayload) =>
    apiFetch<ApiResponse<OutputSpecRecord>>("/api/v2/output-specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteOutputSpecs: (payload: { ids: number[] }) =>
    apiFetch<{ success?: boolean; message?: string; deleted?: boolean }>(
      "/api/v2/output-specs",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  createWorkflowStep: (payload: CreateWorkflowStepPayload) =>
    apiFetch<ApiResponse<WorkflowStepRecord>>("/api/v2/workflow-steps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteWorkflowStep: (workflowStepId: ApiId) =>
    apiFetch<{ success?: boolean; deleted?: boolean }>(
      `/api/v2/workflow-steps/${encodeURIComponent(String(workflowStepId))}`,
      { method: "DELETE" },
    ),
  getAssets: () => apiFetch<ApiListResponse<SourceRecord>>("/api/v2/assets"),
  getSamples: () => apiFetch<ApiListResponse<SourceRecord>>("/api/v2/samples"),
  getDerivatives: () =>
    apiFetch<ApiListResponse<SourceRecord>>("/api/v2/derivatives"),
} as const;

export interface PromptResourceConditionRecord {
  id: number;
  prompt_resource_id: number;
  field_name: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value_type: "manual" | "sample-field";
  value: string;
  position: number;
}

export interface PromptResourceRecord {
  id: number;
  payload_template_id: number;
  name: string;
  source_table: "derivatives" | "samples" | "step_outputs";
  batch_limit: number;
  created_at: string;
  conditions: PromptResourceConditionRecord[];
}
