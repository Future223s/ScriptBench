"use client";

import { WorkflowExampleEditor } from "./WorkflowExampleEditor.js";
import { WorkflowItemSchemaEditor } from "./WorkflowItemSchemaEditor.js";

export function WorkflowPromptSpecStep({ workflowDraft, actions }) {
  return (
    <div className="form-grid">
      <div className="field wide">
        <label htmlFor="prompt-instructions">Instructions</label>
        <textarea
          id="prompt-instructions"
          data-draft="instructions"
          rows="7"
          value={workflowDraft.instructions}
          onChange={(event) => actions.setWorkflowDraftField("instructions", event.target.value)}
          required
        />
      </div>
      <div className="field wide">
        <label>Examples</label>
        <WorkflowExampleEditor examples={workflowDraft.examples} actions={actions} />
      </div>
      <div className="field wide">
        <label>Inputs</label>
        <div className="inputs-card">
          <div className="inputs-row">
            <div className="field">
              <label htmlFor="workflow-input-mode-detail">Selection mode</label>
              <select
                id="workflow-input-mode-detail"
                data-draft="input_mode"
                value={workflowDraft.input_mode}
                onChange={(event) => actions.setWorkflowInputMode(event.target.value)}
              >
                <option value="single">
                  Single sample
                </option>
                <option value="batch">
                  Batch sample set
                </option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="workflow-batch-size">Batch size</label>
              <input
                id="workflow-batch-size"
                type="number"
                min="1"
                data-draft="batch_size"
                value={workflowDraft.batch_size}
                onChange={(event) => actions.setWorkflowDraftField("batch_size", Math.max(1, Number(event.target.value) || 1))}
                disabled={workflowDraft.input_mode === "single"}
              />
            </div>
          </div>
          <div className="field">
            <label>Sample set inputs</label>
            <span className="count-label">
              {workflowDraft.sample_set_id ? "Sample IDs are derived from the selected sample set." : "Choose a sample set in the previous step."}
            </span>
          </div>
        </div>
      </div>
      <div className="field wide">
        <label>Output format</label>
        <div className="inputs-card">
          <div className="inputs-row">
            <div className="field">
              <label htmlFor="output-format-type">Output format type</label>
              <select
                id="output-format-type"
                data-draft="output_format_type"
                value={workflowDraft.output_format_type}
                onChange={(event) => actions.setWorkflowDraftField("output_format_type", event.target.value)}
              >
                <option value="plain_text">
                  plain_text
                </option>
                <option value="json_array">
                  json_array
                </option>
              </select>
            </div>
            <div className="field">
              <label>Type hint</label>
              <span className="count-label">Single input defaults to plain_text. Batch input defaults to json_array.</span>
            </div>
          </div>
          {workflowDraft.output_format_type === "plain_text" ? null : (
            <div className="field">
              <label>Item schema</label>
              <div className="example-editor">
                <WorkflowItemSchemaEditor itemSchemaEntries={workflowDraft.item_schema_entries} actions={actions} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
