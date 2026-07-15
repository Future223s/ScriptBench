"use client";

import { Modal } from "../common/Modal.js";
import {
  findOutputSpec,
  findTemplate,
  formatTemplateOptionLabel,
  formatTemplateSummary,
} from "./workflowBuilderUtils.js";

export function WorkflowStepCreationWizardModal({ state, actions }) {
  const selectedPayloadTemplate = state.wizardDraft.payload_template_mode === "existing"
    ? findTemplate(state.payloadTemplates, state.wizardDraft.payload_template_id) || null
    : null;
  const selectedOutputSpec = state.wizardDraft.output_spec_mode === "existing"
    ? findOutputSpec(state.outputSpecifications, state.wizardDraft.output_spec_id) || null
    : null;

  return (
    <Modal
      open={state.wizardOpen}
      backdropClassName="workflow-builder-modal-backdrop workflow-builder-wizard-backdrop"
      panelClassName="workflow-builder-modal-panel workflow-builder-wizard-modal"
    >
      <div className="modal-header">
        <h2>Create Step</h2>
        <button className="btn-ghost" type="button" onClick={actions.closeWorkflowStepCreationWizard}>
          Close
        </button>
      </div>
      <div className="modal-body workflow-builder-modal-body">
        <div className="stepper">
          {["Step identification", "Payload template", "Output specification"].map((label, index) => (
            <div key={label} className={["step", state.wizardStep === index ? "is-active" : ""].filter(Boolean).join(" ")}>
              {label}
            </div>
          ))}
        </div>
        {state.wizardStep === 0 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="wizard-step-name">Workflow step identification form</label>
              <input
                id="wizard-step-name"
                value={state.wizardDraft.step_name}
                onChange={(event) => actions.setStepWizardField("step_name", event.target.value)}
                placeholder="Review quality"
              />
            </div>
            <div className="field wide">
              <label htmlFor="wizard-step-description">Step description</label>
              <textarea
                id="wizard-step-description"
                rows="5"
                value={state.wizardDraft.step_description}
                onChange={(event) => actions.setStepWizardField("step_description", event.target.value)}
                placeholder="Describe what this workflow step should do."
              />
            </div>
          </div>
        ) : state.wizardStep === 1 ? (
          <div className="workflow-builder-wizard-grid">
            <div className="workflow-builder-wizard-choice-card">
              <div className="workflow-builder-wizard-choice-header">
                <h3>Payload template</h3>
                <p>Select an existing template or create a new one inline.</p>
              </div>
              <div className="workflow-builder-wizard-switch" role="tablist" aria-label="Choose a payload template mode">
                <button
                  className={["workflow-builder-wizard-switch-option", state.wizardDraft.payload_template_mode === "existing" ? "is-active" : ""].filter(Boolean).join(" ")}
                  type="button"
                  role="tab"
                  aria-selected={state.wizardDraft.payload_template_mode === "existing"}
                  onClick={() => actions.setStepWizardField("payload_template_mode", "existing")}
                >
                  Use existing template
                </button>
                <button
                  className={["workflow-builder-wizard-switch-option", state.wizardDraft.payload_template_mode === "new" ? "is-active" : ""].filter(Boolean).join(" ")}
                  type="button"
                  role="tab"
                  aria-selected={state.wizardDraft.payload_template_mode === "new"}
                  onClick={() => actions.setStepWizardField("payload_template_mode", "new")}
                >
                  Create new template
                </button>
              </div>
            </div>
            {state.wizardDraft.payload_template_mode === "existing" ? (
              <>
                <div className="field wide">
                  <label htmlFor="payload-template-selector">Choose a payload template</label>
                  <select
                    id="payload-template-selector"
                    value={state.wizardDraft.payload_template_id}
                    onChange={(event) => {
                      actions.setStepWizardField("payload_template_mode", "existing");
                      actions.setStepWizardPayloadTemplateField("payload_template_id", event.target.value);
                    }}
                  >
                    {state.payloadTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {formatTemplateOptionLabel(template)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="detail-card wide workflow-builder-wizard-summary-card">
                  <div className="workflow-builder-wizard-summary-title">{selectedPayloadTemplate?.name || "Selected payload template"}</div>
                  <p>{formatTemplateSummary(selectedPayloadTemplate) || "Select a payload template to review its description and inputs."}</p>
                  <div className="workflow-builder-wizard-summary-actions" />
                </div>
              </>
            ) : (
              <div className="detail-card wide workflow-builder-wizard-create-card">
                <div className="workflow-builder-wizard-summary-title">Create payload template</div>
                <p>Create a reusable payload template for this step.</p>
                <div className="form-grid workflow-builder-inline-form">
                  <div className="field wide">
                    <label htmlFor="payload-template-name">Template name</label>
                    <input
                      id="payload-template-name"
                      value={state.wizardDraft.payload_template_name}
                      onChange={(event) => actions.setStepWizardPayloadTemplateField("payload_template_name", event.target.value)}
                      placeholder="Step payload template"
                    />
                  </div>
                  <div className="field wide">
                    <label htmlFor="payload-template-description">Description</label>
                    <textarea
                      id="payload-template-description"
                      rows="3"
                      value={state.wizardDraft.payload_template_description}
                      onChange={(event) => actions.setStepWizardPayloadTemplateField("payload_template_description", event.target.value)}
                    />
                  </div>
                  <div className="field wide">
                    <label>Inputs</label>
                    <div className="workflow-builder-list">
                      {state.wizardDraft.payload_template_inputs.map((input, index) => (
                        <div key={`${index}-${input.name}`} className="workflow-builder-list-row">
                          <input
                            value={input.name}
                            onChange={(event) => actions.updateStepWizardPayloadTemplateInput(index, "name", event.target.value)}
                            placeholder="Input name"
                          />
                          <input
                            value={input.description}
                            onChange={(event) => actions.updateStepWizardPayloadTemplateInput(index, "description", event.target.value)}
                            placeholder="Input description"
                          />
                          <button className="btn-ghost" type="button" onClick={() => actions.removeStepWizardPayloadTemplateInput(index)}>
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                    <button className="btn-secondary" type="button" onClick={actions.addStepWizardPayloadTemplateInput}>
                      Add Input
                    </button>
                  </div>
                </div>
                <div className="workflow-builder-wizard-create-actions">
                  <button className="btn-primary" type="button" onClick={actions.createStepWizardPayloadTemplate}>
                    Create template
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="workflow-builder-wizard-grid">
            <div className="field wide">
              <label htmlFor="output-spec-selector">Output specification selector</label>
              <select
                id="output-spec-selector"
                value={state.wizardDraft.output_spec_mode === "existing" ? state.wizardDraft.output_spec_id : ""}
                onChange={(event) => {
                  actions.setStepWizardField("output_spec_mode", "existing");
                  actions.setStepWizardOutputSpecField("output_spec_id", event.target.value);
                }}
              >
                {state.outputSpecifications.map((spec) => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-actions wide">
              <button
                className={["btn-secondary", state.wizardDraft.output_spec_mode === "new" ? "is-active" : ""].filter(Boolean).join(" ")}
                type="button"
                onClick={() => actions.setStepWizardField("output_spec_mode", "new")}
              >
                Create Output Specification
              </button>
            </div>
            <div className="detail-card wide">
              <h3>{state.wizardDraft.output_spec_mode === "new" ? "Output specification creation form" : selectedOutputSpec?.name || "Selected output specification"}</h3>
              <p>{state.wizardDraft.output_spec_mode === "new" ? "Create the output shape for this step." : selectedOutputSpec?.description || "Inspect the selected output specification."}</p>
              {state.wizardDraft.output_spec_mode === "new" ? (
                <div className="form-grid workflow-builder-inline-form">
                  <div className="field wide">
                    <label htmlFor="output-spec-name">Output specification metadata form</label>
                    <input
                      id="output-spec-name"
                      value={state.wizardDraft.output_spec_name}
                      onChange={(event) => actions.setStepWizardOutputSpecField("output_spec_name", event.target.value)}
                      placeholder="Structured review output"
                    />
                  </div>
                  <div className="field wide">
                    <label htmlFor="output-spec-description">Description</label>
                    <textarea
                      id="output-spec-description"
                      rows="3"
                      value={state.wizardDraft.output_spec_description}
                      onChange={(event) => actions.setStepWizardOutputSpecField("output_spec_description", event.target.value)}
                    />
                  </div>
                  <div className="field wide">
                    <label>Output specification inputs list</label>
                    <div className="workflow-builder-list">
                      {state.wizardDraft.output_spec_fields.map((field, index) => (
                        <div key={`${index}-${field.name}`} className="workflow-builder-list-row">
                          <input
                            value={field.name}
                            onChange={(event) => actions.updateStepWizardOutputSpecField(index, "name", event.target.value)}
                            placeholder="Field name"
                          />
                          <input
                            value={field.description}
                            onChange={(event) => actions.updateStepWizardOutputSpecField(index, "description", event.target.value)}
                            placeholder="Field description"
                          />
                          <button className="btn-ghost" type="button" onClick={() => actions.removeStepWizardOutputSpecField(index)}>
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                    <button className="btn-secondary" type="button" onClick={actions.addStepWizardOutputSpecField}>
                      Add Field
                    </button>
                  </div>
                </div>
              ) : (
                <div className="metadata-grid">
                  <div className="metadata-row">
                    <span>Specification</span>
                    <strong>{selectedOutputSpec?.name || "Unknown"}</strong>
                  </div>
                  <div className="metadata-row">
                    <span>Fields</span>
                    <strong>{selectedOutputSpec?.fields?.length || 0}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="btn-ghost"
          type="button"
          onClick={state.wizardStep === 0 ? actions.closeWorkflowStepCreationWizard : actions.previousWorkflowStepCreationWizardStep}
        >
          {state.wizardStep === 0 ? "Cancel" : "Back"}
        </button>
        <div className="inline-actions">
          {state.wizardStep < 2 ? (
            <button className="btn-primary" type="button" onClick={actions.nextWorkflowStepCreationWizardStep}>
              Next
            </button>
          ) : (
            <button className="btn-primary" type="button" onClick={actions.submitWorkflowStepCreation}>
              Create Workflow Step
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
