"use client";

import { WorkflowIdentityStep } from "./WorkflowIdentityStep.js";
import { WorkflowPromptSpecStep } from "./WorkflowPromptSpecStep.js";
import { WorkflowSampleSetStep } from "./WorkflowSampleSetStep.js";
import { WorkflowWizardFooter } from "./WorkflowWizardFooter.js";
import { WorkflowWizardStepper } from "./WorkflowWizardStepper.js";

export function WorkflowCreationModal({ state, actions }) {
  function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action === "close-modals") {
      actions.closeWorkflowWizard();
      return;
    }
    if (action === "wizard-next") {
      actions.nextWorkflowStep();
      return;
    }
    if (action === "wizard-back") {
      actions.previousWorkflowStep();
      return;
    }
    if (action === "add-example") {
      actions.addWorkflowExample();
      return;
    }
    if (action === "remove-example") {
      actions.removeWorkflowExample(Number(target.dataset.exampleIndex));
      return;
    }
    if (action === "add-schema-field") {
      actions.addWorkflowSchemaField();
      return;
    }
    if (action === "remove-schema-field") {
      actions.removeWorkflowSchemaField(Number(target.dataset.schemaIndex));
    }
  }

  function handleSubmit(event) {
    if (event.target.id !== "workflow-form") return;
    event.preventDefault();
    void actions.submitWorkflow();
  }

  return (
    <div className={["modal-backdrop", state.open ? "" : "is-hidden"].filter(Boolean).join(" ")} data-modal="workflow">
      <form className="modal" id="workflow-form" onClick={handleClick} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>Create workflow</h2>
          <button className="btn-ghost" type="button" data-action="close-modals">
            Close workflow
          </button>
        </div>
        <div className="modal-body">
          <WorkflowWizardStepper wizardStep={state.wizardStep} />
          {state.wizardStep === 0 ? (
            <WorkflowIdentityStep workflowDraft={state.workflowDraft} actions={actions} />
          ) : state.wizardStep === 1 ? (
            <WorkflowSampleSetStep workflowDraft={state.workflowDraft} sampleSets={state.sampleSets} actions={actions} />
          ) : (
            <WorkflowPromptSpecStep workflowDraft={state.workflowDraft} actions={actions} />
          )}
        </div>
        <WorkflowWizardFooter wizardStep={state.wizardStep} />
      </form>
    </div>
  );
}
