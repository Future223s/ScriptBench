"use client";

import { Panel } from "../common/Panel.js";

export function WorkflowBuilderMetadataForm({ state, actions }) {
  return (
    <Panel className="workflow-builder-panel workflow-builder-metadata-panel">
      <div className="workflow-builder-metadata-header">
        <div className="panel-title">
          <h2>Builder</h2>
        </div>
      </div>
      <div className="workflow-builder-panel-body">
        <div className="form-grid">
          <div className="field wide">
            <label htmlFor="workflow-name">Workflow name</label>
            <input
              id="workflow-name"
              value={state.workflowDraft.workflow_name}
              onChange={(event) => actions.setWorkflowDraftField("workflow_name", event.target.value)}
              placeholder="Workflow Builder"
            />
          </div>
          <div className="field wide">
            <label htmlFor="workflow-description">Workflow description</label>
            <textarea
              id="workflow-description"
              rows="2"
              value={state.workflowDraft.workflow_description}
              onChange={(event) => actions.setWorkflowDraftField("workflow_description", event.target.value)}
              placeholder="Describe the steps, handoffs, and output shape."
            />
          </div>
          <div className="field wide">
            <label htmlFor="workflow-sample-set">Sample set</label>
            <select
              id="workflow-sample-set"
              value={state.workflowDraft.sample_set_id || ""}
              onChange={(event) => actions.setWorkflowDraftField("sample_set_id", Number(event.target.value) || null)}
            >
              <option value="">Choose a sample set</option>
              {state.sampleSets.length ? (
                state.sampleSets.map((sampleSet) => (
                  <option key={sampleSet.sample_set_id} value={sampleSet.sample_set_id}>
                    {sampleSet.sample_set_name} ({sampleSet.sample_count || 0} samples)
                  </option>
                ))
              ) : (
                <option value="">No sample sets available</option>
              )}
            </select>
          </div>
          <div className="field">
            <label htmlFor="workflow-model">Model</label>
            <input
              id="workflow-model"
              value={state.workflowDraft.model}
              onChange={(event) => actions.setWorkflowDraftField("model", event.target.value)}
              placeholder="Optional model name"
            />
          </div>
          <div className="field">
            <label htmlFor="workflow-model-family">Model family</label>
            <select
              id="workflow-model-family"
              value={state.workflowDraft.model_family}
              onChange={(event) => actions.setWorkflowDraftField("model_family", event.target.value)}
            >
              {["gemini", "gpt", "claude", "mistral", "escriptorium"].map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="workflow-builder-form-footer">
          <div className="count-label">
            {state.sampleSets.length
              ? `${state.sampleSets.length} sample sets loaded.`
              : "No sample sets available yet."}
          </div>
        </div>
      </div>
    </Panel>
  );
}
