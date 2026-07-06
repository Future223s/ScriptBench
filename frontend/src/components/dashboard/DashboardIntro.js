"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";

export function DashboardIntro({ onNavigateFileManagement }) {
  return (
    <section className="dashboard-intro">
      <Panel as="aside" className="dashboard-empty-sidebar">
        <div className="panel-header">
          <div className="panel-title">
            <h2>Sample sets</h2>
            <span>Nothing created yet</span>
          </div>
        </div>
        <div className="empty-sidebar-body">
          <EmptyState>No sample sets yet. Start in File Management, then create a workflow.</EmptyState>
        </div>
      </Panel>

      <Panel className="dashboard-intro-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h2>Workflow creation</h2>
            <span>Follow these steps to prepare and open a workflow</span>
          </div>
          <button className="btn-primary" type="button" onClick={onNavigateFileManagement}>
            Go to File Management
          </button>
        </div>
        <div className="dashboard-intro-steps">
          <div className="intro-step">
            <span className="intro-step-number">1</span>
            <div>
              <strong>Navigate to File Management</strong>
              <p>Open the sample management area using the button above.</p>
            </div>
          </div>
          <div className="intro-step">
            <span className="intro-step-number">2</span>
            <div>
              <strong>Upload samples and ground truths</strong>
              <p>Add the source files that will power future sample sets.</p>
            </div>
          </div>
          <div className="intro-step">
            <span className="intro-step-number">3</span>
            <div>
              <strong>Create a sample set</strong>
              <p>Bundle the curated samples into an immutable set for workflows.</p>
            </div>
          </div>
          <div className="intro-step">
            <span className="intro-step-number">4</span>
            <div>
              <strong>Create a workflow</strong>
              <p>Name the workflow, choose the model, and attach the sample set.</p>
            </div>
          </div>
          <div className="intro-step">
            <span className="intro-step-number">5</span>
            <div>
              <strong>Open Workflow Workspace</strong>
              <p>Enter the workspace to queue jobs, assemble transcriptions, and review results.</p>
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
