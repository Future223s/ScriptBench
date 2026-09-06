"use client";

import { Dialog, Stack } from "../../ui/primitives/index.js";
import { WorkflowIdentityStep } from "./WorkflowIdentityStep.js";
import { WorkflowPromptSpecStep } from "./WorkflowPromptSpecStep.js";
import { WorkflowSampleSetStep } from "./WorkflowSampleSetStep.js";
import { WorkflowWizardFooter } from "./WorkflowWizardFooter.js";
import { WorkflowWizardStepper } from "./WorkflowWizardStepper.js";

export function WorkflowCreationModal({ state, actions }) {
  function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "add-example") actions.addWorkflowExample();
    if (target.dataset.action === "remove-example")
      actions.removeWorkflowExample(Number(target.dataset.exampleIndex));
    if (target.dataset.action === "add-schema-field")
      actions.addWorkflowSchemaField();
    if (target.dataset.action === "remove-schema-field")
      actions.removeWorkflowSchemaField(Number(target.dataset.schemaIndex));
  }

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
        onClick={handleClick}
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
          {state.wizardStep === 2 ? (
            <WorkflowPromptSpecStep
              workflowDraft={state.workflowDraft}
              actions={actions}
            />
          ) : null}
        </Stack>
      </form>
    </Dialog>
  );
}
