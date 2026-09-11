"use client";

import { WorkflowStepsPageView } from "../../../components/workflow-steps/WorkflowStepsPageView.js";
import { useWorkflowStepsPage } from "../../../hooks/workflow-steps/useWorkflowStepsPage.js";

export default function WorkflowStepsRoute() {
  const workflowSteps = useWorkflowStepsPage();

  return (
    <WorkflowStepsPageView
      state={workflowSteps.state}
      actions={workflowSteps.actions}
    />
  );
}
