"use client";

import { Dialog, Stack } from "../../ui/primitives/index.js";
import { WorkflowIdentityStep } from "./WorkflowIdentityStep.js";
import { WorkflowSampleSetStep } from "./WorkflowSampleSetStep.js";
import { WorkflowWizardFooter } from "./WorkflowWizardFooter.js";
import { WorkflowWizardStepper } from "./WorkflowWizardStepper.js";

export function WorkflowCreationModal({ state, actions }) {
  return (
    <Dialog
      open={state.open}
      title="Create workflow"
      onClose={actions.closeWorkflowWizard}
      size="wide"
      footer={
        <WorkflowWizardFooter wizardStep={state.wizardStep} actions={actions} />
      }
    >
      <form
        id="workflow-form"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.submitWorkflow();
        }}
      >
        <Stack gap="default">
          <WorkflowWizardStepper wizardStep={state.wizardStep} />
          {state.wizardStep === 0 ? (
            <WorkflowIdentityStep
              workflowDraft={state.workflowDraft}
              actions={actions}
            />
          ) : null}
          {state.wizardStep === 1 ? (
            <WorkflowSampleSetStep
              workflowDraft={state.workflowDraft}
              sampleSets={state.sampleSets}
              actions={actions}
            />
          ) : null}
        </Stack>
      </form>
    </Dialog>
  );
}
