export function workflowStageLabel(workspace) {
  return workspace?.workflow?.workflow_stage || workspace?.workflow?.stage || "Stage";
}
