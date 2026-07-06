"use client";

import Link from "next/link";

import { renderSampleSetAnalyticsPanel, renderSampleSetsPanel } from "../SampleSetsPanel.js";

export function DashboardPageView({
  loading,
  error,
  notice,
  sampleSets,
  selectedSampleSetId,
  sampleSetAnalytics,
  sampleSetAnalyticsLoading,
  sampleSetAnalyticsError,
  onRefresh,
  onSelectSampleSet,
  onDeleteSampleSet,
  onDeleteWorkflow,
}) {
  const handleSampleSetPanelClick = (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === "select-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      if (sampleSetId) {
        void onSelectSampleSet(sampleSetId);
      }
      return;
    }

    if (action === "delete-sample-set") {
      const sampleSetId = Number(actionTarget.dataset.sampleSetId);
      if (sampleSetId) {
        void onDeleteSampleSet(sampleSetId);
      }
    }
  };

  const handleAnalyticsClick = (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    if (actionTarget.dataset.action !== "delete-workflow") return;

    const workflowId = Number(actionTarget.dataset.workflowId);
    if (!workflowId) return;
    void onDeleteWorkflow(workflowId, actionTarget.dataset.workflowName || "");
  };

  const selectedSampleSet = sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === Number(selectedSampleSetId)) || null;
  const hasSampleSets = sampleSets.length > 0;

  return (
    <div className="page-surface">
      {notice ? <div className="success-banner">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {loading && !hasSampleSets ? (
        <section className="dashboard-grid dashboard-grid-intro">
          <div className="panel">
            <div className="empty-state">Loading dashboard...</div>
          </div>
        </section>
      ) : !hasSampleSets ? (
        <section className="dashboard-grid dashboard-grid-intro">
          <aside className="panel dashboard-empty-sidebar">
            <div className="panel-header">
              <div className="panel-title">
                <h2>Sample sets</h2>
                <span>Nothing created yet</span>
              </div>
            </div>
            <div className="empty-sidebar-body">
              <div className="empty-state">No sample sets yet. Start in File Management, then create a workflow.</div>
            </div>
          </aside>

          <section className="panel dashboard-intro-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h2>Workflow creation</h2>
                <span>Follow these steps to prepare and open a workflow</span>
              </div>
              <Link href="/file-management" className="btn-primary">
                Open File Management
              </Link>
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
          </section>
        </section>
      ) : (
        <section className="dashboard-grid">
          <section onClick={handleSampleSetPanelClick}>
            <div dangerouslySetInnerHTML={{ __html: renderSampleSetsPanel({ sampleSets, selectedSampleSetId }) }} />
          </section>
          <div className="main-area">
            <div className="inline-actions" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
              <button className="btn-secondary" type="button" onClick={() => void onRefresh()}>
                Refresh
              </button>
              <Link href="/workspace" className="btn-primary">
                Open Workspace
              </Link>
            </div>
            {sampleSetAnalyticsLoading ? (
              <section className="panel">
                <div className="empty-state">Loading analytics...</div>
              </section>
            ) : sampleSetAnalyticsError ? (
              <section className="panel">
                <div className="error-banner">{sampleSetAnalyticsError}</div>
              </section>
            ) : selectedSampleSet ? (
              <div onClick={handleAnalyticsClick}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderSampleSetAnalyticsPanel({
                      workflow: selectedSampleSet,
                      sampleSet: selectedSampleSet,
                      sampleSetAnalytics,
                      analyticsLoading: false,
                      analyticsError: "",
                    }),
                  }}
                />
              </div>
            ) : (
              <section className="panel">
                <div className="empty-state">Please select a sample set to view analytics.</div>
              </section>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
