import { api } from "./api.js";

export function getWorkflows() {
  return api("/api/v1/workflows");
}

export function getSamples(queryString = "") {
  return api(`/api/v1/samples${queryString}`);
}

export function getGroupings() {
  return api("/api/v1/groupings");
}

export function getSampleSets() {
  return api("/api/v1/sample-sets");
}

export function getSampleSetAnalytics(sampleSetId) {
  return api(`/api/v1/sample-sets/${encodeURIComponent(sampleSetId)}/analytics`);
}

export function getWorkspace(workflowId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace`);
}

export function markWorkspaceOpened(workflowId, workflowStage) {
  return api(`/api/workspaces/${encodeURIComponent(workflowId)}/opened?workflow_stage=${encodeURIComponent(workflowStage)}`, {
    method: "POST",
  });
}

export function createWorkspaceJobs(workflowId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/jobs`, {
    method: "POST",
  });
}

export const createWorkflowJobs = createWorkspaceJobs;

export function queueWorkspaceJobs(workflowId, jobIds = []) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/jobs/queue`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_ids: jobIds.length ? jobIds : null }),
  });
}

export function retryWorkspaceJobs(workflowId, jobIds = []) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/jobs/retry`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_ids: jobIds.length ? jobIds : null }),
  });
}

export function deleteWorkspaceJobs(workflowId, kind = "all") {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/jobs${query}`, {
    method: "DELETE",
  });
}

export function createWorkspaceTranscriptions(workflowId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/transcriptions`, {
    method: "POST",
  });
}

export function scoreWorkspace(workflowId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/score`, {
    method: "POST",
  });
}

export function getSample(sampleId) {
  return api(`/api/v1/samples/${encodeURIComponent(sampleId)}`);
}

export function getTranscriptionJob(jobId) {
  return api(`/api/transcription-jobs/${encodeURIComponent(jobId)}`);
}

export function getWorkspaceJob(workflowId, jobId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/jobs/${encodeURIComponent(jobId)}`);
}

export function getWorkspaceTranscription(workflowId, transcriptionId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}/workspace/transcriptions/${encodeURIComponent(transcriptionId)}`);
}

export function updateTranscriptionJob(jobId, payload) {
  return api(`/api/transcription-jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function createSample(formData) {
  return api("/api/v1/samples", { method: "POST", body: formData });
}

export function createGrouping(payload) {
  return api("/api/v1/groupings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function createGroupingValue(groupName, payload) {
  return api(`/api/v1/groupings/${encodeURIComponent(groupName)}/values`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function createSampleSet(payload) {
  return api("/api/v1/sample-sets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteSampleSet(sampleSetId) {
  return api(`/api/v1/sample-sets/${encodeURIComponent(sampleSetId)}`, {
    method: "DELETE",
  });
}

export function createWorkflow(payload) {
  return api("/api/v1/workflows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteWorkflow(workflowId) {
  return api(`/api/v1/workflows/${encodeURIComponent(workflowId)}`, {
    method: "DELETE",
  });
}

export function deleteSample(sampleId) {
  return api(`/api/v1/samples/${encodeURIComponent(sampleId)}`, {
    method: "DELETE",
  });
}

export function deleteGrouping(groupName) {
  return api(`/api/v1/groupings/${encodeURIComponent(groupName)}`, {
    method: "DELETE",
  });
}
