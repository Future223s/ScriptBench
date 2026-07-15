"use client";

import { Modal } from "../common/Modal.js";
import {
  formatStepOptionLabel,
  formatStepSummary,
} from "./workflowBuilderUtils.js";

export function WorkflowStepAssignmentModal({ state, actions }) {
  const selectedStep = state.stepCatalog.find((step) => step.id === state.assignmentStepId) || state.stepCatalog[0] || null;
  const isCreateMode = state.assignmentMode === "create";

  return (
    <Modal
      open={state.assignmentOpen}
      backdropClassName="workflow-builder-modal-backdrop workflow-builder-assignment-backdrop"
      panelClassName="workflow-builder-modal-panel workflow-builder-assignment-modal"
    >
      <div className="modal-header">
        <h2>Add workflow step</h2>
        <button className="btn-ghost" type="button" onClick={actions.cancelCanvasAction}>
          Close
        </button>
      </div>
      <div className="modal-body workflow-builder-modal-body workflow-builder-assignment-stack">
        <section className="workflow-builder-assignment-card workflow-builder-assignment-choice-card">
          <div className="workflow-builder-assignment-card-header">
            <div className="panel-title">
              <h2>How would you like to add a step?</h2>
            </div>
          </div>
          <div className="workflow-builder-assignment-switch" role="tablist" aria-label="Choose how to add a step">
            <button
              className={["workflow-builder-assignment-switch-option", !isCreateMode ? "is-active" : ""].filter(Boolean).join(" ")}
              type="button"
              role="tab"
              aria-selected={!isCreateMode}
              onClick={() => actions.setAssignmentMode("existing")}
            >
              Use existing step
            </button>
            <button
              className={["workflow-builder-assignment-switch-option", isCreateMode ? "is-active" : ""].filter(Boolean).join(" ")}
              type="button"
              role="tab"
              aria-selected={isCreateMode}
              onClick={() => actions.setAssignmentMode("create")}
            >
              Create new step
            </button>
          </div>
        </section>
        {!isCreateMode ? (
          <>
            <section className="workflow-builder-assignment-card workflow-builder-assignment-selector-card">
              <div className="workflow-builder-assignment-card-header">
                <div className="panel-title">
                  <h2>Choose a step</h2>
                </div>
              </div>
              <div className="workflow-builder-assignment-card-body">
                <div className="field">
                  <label htmlFor="workflow-step-selector">Choose a step</label>
                  <select id="workflow-step-selector" value={state.assignmentStepId} onChange={(event) => actions.selectWorkflowStep(event.target.value)}>
                    {state.stepCatalog.map((step) => (
                      <option key={step.id} value={step.id}>
                        {formatStepOptionLabel(step)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
            <section className="workflow-builder-assignment-card workflow-builder-assignment-selected-card">
              <div className="workflow-builder-assignment-card-header">
                <div className="panel-title">
                  <h2>Selected Step</h2>
                </div>
              </div>
              <div className="workflow-builder-assignment-summary-card">
                <h3>{selectedStep?.name || "Choose a step"}</h3>
                <p>{formatStepSummary(selectedStep)}</p>
              </div>
            </section>
          </>
        ) : (
          <section className="workflow-builder-assignment-card workflow-builder-assignment-create-card">
            <div className="workflow-builder-assignment-card-header">
              <div className="panel-title">
                <h2>Create new step</h2>
              </div>
            </div>
            <div className="workflow-builder-assignment-card-body">
              <p className="workflow-builder-assignment-create-copy">Create a new step when the existing catalog does not match what you need.</p>
            </div>
            <div className="workflow-builder-assignment-card-footer workflow-builder-assignment-card-footer-left">
              <button className="btn-secondary" type="button" onClick={actions.openWorkflowStepCreationWizard}>
                Create Workflow Step
              </button>
            </div>
          </section>
        )}
      </div>
      <div className="modal-footer workflow-builder-assignment-footer">
        <button className="btn-ghost" type="button" onClick={actions.cancelCanvasAction}>
          Cancel
        </button>
        {!isCreateMode ? (
          <button className="btn-primary" type="button" onClick={actions.submitWorkflowStepAssignment}>
            Add step
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
