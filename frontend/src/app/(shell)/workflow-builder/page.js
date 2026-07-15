"use client";

import { WorkflowBuilderPageView } from "../../../components/workflow-builder/WorkflowBuilderPageView.js";
import { useWorkflowBuilderPage } from "../../../hooks/workflow-builder/useWorkflowBuilderPage.js";

export default function WorkflowBuilderRoute() {
  const workflowBuilder = useWorkflowBuilderPage();

  return <WorkflowBuilderPageView state={workflowBuilder.state} actions={workflowBuilder.actions} />;
}
