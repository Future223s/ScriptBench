"use client";

import { modelFamilies } from "../../utils/workflow.js";

export function WorkflowIdentityStep({ workflowDraft, actions }) {
  return (
    <div className="form-grid">
      <div className="field wide">
        <label htmlFor="workflow-name">Workflow name</label>
        <input
          id="workflow-name"
          data-draft="workflow_name"
          value={workflowDraft.workflow_name}
          onChange={(event) => actions.setWorkflowDraftField("workflow_name", event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="workflow-stage">Workflow stage</label>
        <input
          id="workflow-stage"
          data-draft="workflow_stage"
          value={workflowDraft.workflow_stage}
          onChange={(event) => actions.setWorkflowDraftField("workflow_stage", event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="model-family">Model family</label>
        <select
          id="model-family"
          data-draft="model_family"
          value={workflowDraft.model_family}
          onChange={(event) => actions.setWorkflowDraftField("model_family", event.target.value)}
        >
          {modelFamilies.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="model-name">Model</label>
        <input
          id="model-name"
          data-draft="model"
          value={workflowDraft.model}
          onChange={(event) => actions.setWorkflowDraftField("model", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="workflow-groups">Groups</label>
        <input
          id="workflow-groups"
          data-draft="groups"
          value={workflowDraft.groups}
          onChange={(event) => actions.setWorkflowDraftField("groups", event.target.value)}
          placeholder="Comma separated"
        />
      </div>
    </div>
  );
}
