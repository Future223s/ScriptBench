import { escapeHtml } from "../utils/html.js";
import { formatDate } from "../utils/date.js";

function renderTrashIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7h15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M9 7V5.8c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4V7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M7.5 7.2l.6 11.3c0 .9.7 1.5 1.6 1.5h4.6c.9 0 1.6-.6 1.6-1.5l.6-11.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
}

export function renderWorkflowPanel({ workflows, selectedWorkflowId }) {
  const cards = workflows.length
    ? workflows.map((workflow) => `
      <div class="workflow-card ${Number(workflow.workflow_id) === Number(selectedWorkflowId) ? "is-selected" : ""}"
        data-action="select-workflow"
        title="Click to select"
        data-workflow-id="${escapeHtml(workflow.workflow_id)}">
        <div class="workflow-card-body">
          <strong>${escapeHtml(workflow.workflow_name)}</strong>
          <div class="meta-line">
            <span class="badge green">${escapeHtml(workflow.model_family)}</span>
            <span class="badge">${escapeHtml(workflow.workflow_stage)}</span>
            <span class="badge amber">${escapeHtml(workflow.status)}</span>
          </div>
          <div class="meta-line">
            <span>${escapeHtml(workflow.sample_count || 0)} samples</span>
            <span>${escapeHtml(formatDate(workflow.updated_at))}</span>
          </div>
        </div>
        <div class="workflow-card-actions">
          <button class="btn-primary btn-tight" type="button" data-action="open-workspace" data-workflow-id="${escapeHtml(workflow.workflow_id)}">Open workflow</button>
          <button class="btn-danger btn-tight icon-delete-button" type="button" data-action="delete-workflow" data-workflow-id="${escapeHtml(workflow.workflow_id)}" aria-label="Delete workflow ${escapeHtml(workflow.workflow_name)}" title="Delete workflow">${renderTrashIcon()}</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">No workflows yet.</div>`;

  return `
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Workflow list</h2>
          <span>Click to select, use Open workflow to enter the workspace</span>
        </div>
      </div>
      <div class="workflow-list">${cards}</div>
    </section>
  `;
}
