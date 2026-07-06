import { escapeHtml } from "../utils/html.js";

export function renderDashboardIntro({ onNavigateLabel = "Go to File Management" } = {}) {
  return `
    <section class="dashboard-intro">
      <aside class="panel dashboard-empty-sidebar">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Sample sets</h2>
            <span>Nothing created yet</span>
          </div>
        </div>
        <div class="empty-sidebar-body">
          <div class="empty-state">No sample sets yet. Start in File Management, then create a workflow.</div>
        </div>
      </aside>

      <section class="panel dashboard-intro-panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Workflow creation</h2>
            <span>Follow these steps to prepare and open a workflow</span>
          </div>
          <button class="btn-primary" type="button" data-action="prototype-nav" data-nav-key="file-management">
            ${escapeHtml(onNavigateLabel)}
          </button>
        </div>
        <div class="dashboard-intro-steps">
          <div class="intro-step">
            <span class="intro-step-number">1</span>
            <div>
              <strong>Navigate to File Management</strong>
              <p>Open the sample management area using the button above.</p>
            </div>
          </div>
          <div class="intro-step">
            <span class="intro-step-number">2</span>
            <div>
              <strong>Upload samples and ground truths</strong>
              <p>Add the source files that will power future sample sets.</p>
            </div>
          </div>
          <div class="intro-step">
            <span class="intro-step-number">3</span>
            <div>
              <strong>Create a sample set</strong>
              <p>Bundle the curated samples into an immutable set for workflows.</p>
            </div>
          </div>
          <div class="intro-step">
            <span class="intro-step-number">4</span>
            <div>
              <strong>Create a workflow</strong>
              <p>Name the workflow, choose the model, and attach the sample set.</p>
            </div>
          </div>
          <div class="intro-step">
            <span class="intro-step-number">5</span>
            <div>
              <strong>Open Workflow Workspace</strong>
              <p>Enter the workspace to queue jobs, assemble transcriptions, and review results.</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;
}
