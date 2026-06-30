import { escapeHtml } from "../utils/html.js";

export function renderWorkflowWorkspacePicker({ workflows, selectedWorkflowId, loading, error = "" }) {
  const options = workflows.length
    ? workflows.map((workflow) => `
      <option value="${escapeHtml(workflow.workflow_id)}" ${Number(workflow.workflow_id) === Number(selectedWorkflowId) ? "selected" : ""}>
        ${escapeHtml(workflow.workflow_name)}
      </option>
    `).join("")
    : `<option value="">No workflows available</option>`;

  return `
    <section class="workspace-shell">
      <section class="panel workspace-picker-panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Workflow workspace</h2>
            <span>${loading ? "Loading workflows..." : "Pick a workflow or create one to continue"}</span>
          </div>
          <button class="btn-primary" type="button" data-action="open-workflow">Create workflow</button>
        </div>

        <div class="workspace-picker-body">
          ${error ? `<div class="error-banner">${escapeHtml(error)}</div>` : ""}
          <div class="field wide workspace-picker-select">
              <label for="workspace-workflow-select">Existing workflows</label>
              <select id="workspace-workflow-select">
                <option value="">Choose a workflow</option>
                ${options}
              </select>
          </div>
          <div class="workspace-picker-actions">
            <button class="btn-secondary" type="button" data-action="open-selected-workflow" ${selectedWorkflowId ? "" : "disabled"}>
              Open workflow
            </button>
            <p class="count-label">If you already have a workflow, select it here. Otherwise create a new one from the top bar or here.</p>
          </div>
        </div>
      </section>
    </section>
  `;
}
