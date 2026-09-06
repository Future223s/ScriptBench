"use client";

import { Button, Inline } from "../../ui/primitives/index.js";

export function WorkflowWizardFooter({ wizardStep, actions }) {
  return (
    <Inline gap="compact" justify="end">
      <Button
        size="compact"
        onClick={
          wizardStep === 0
            ? actions.closeWorkflowWizard
            : actions.previousWorkflowStep
        }
      >
        {wizardStep === 0 ? "Cancel" : "Back"}
      </Button>
      <Button
        size="compact"
        variant="primary"
        onClick={
          wizardStep < 2 ? actions.nextWorkflowStep : actions.submitWorkflow
        }
      >
        {wizardStep < 2 ? "Next" : "Create"}
      </Button>
    </Inline>
  );
}
