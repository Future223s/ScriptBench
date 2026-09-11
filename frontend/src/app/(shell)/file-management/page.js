"use client";

import { FileManagementPageView } from "../../../components/file-management/FileManagementPageView.js";
import { useFileManagementPage } from "../../../hooks/file-management/useFileManagementPage.js";
import { useWorkflowStepsPage } from "../../../hooks/workflow-steps/useWorkflowStepsPage.js";

export default function FileManagementRoute() {
  const fileManagement = useFileManagementPage();
  const workflowSteps = useWorkflowStepsPage();

  const workflowStepActions = {
    ...workflowSteps.actions,
    submitCreateSampleSet: async (...args) => {
      const result = await workflowSteps.actions.submitCreateSampleSet(
        ...args,
      );
      await fileManagement.actions.refresh();
      return result;
    },
    submitCreateDerivativeGroup: async (...args) => {
      const result = await workflowSteps.actions.submitCreateDerivativeGroup(
        ...args,
      );
      await fileManagement.actions.refresh();
      return result;
    },
  };

  return (
    <FileManagementPageView
      state={{
        ...fileManagement.state,
        workflowStepsState: workflowSteps.state,
      }}
      actions={{
        ...fileManagement.actions,
        workflowStepsActions: workflowStepActions,
      }}
    />
  );
}
