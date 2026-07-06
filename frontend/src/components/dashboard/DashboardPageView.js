"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Panel } from "../common/Panel.js";
import { DashboardIntro } from "./DashboardIntro.js";
import { SampleSetAnalyticsPanel } from "./SampleSetAnalyticsPanel.js";
import { SampleSetsPanel } from "./SampleSetsPanel.js";

export function DashboardPageView({
  loading,
  sampleSets,
  selectedSampleSetId,
  sampleSetAnalytics,
  sampleSetAnalyticsLoading,
  onSelectSampleSet,
  onDeleteSampleSet,
  onDeleteWorkflow,
  onNavigateFileManagement,
}) {
  const selectedSampleSet =
    sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === Number(selectedSampleSetId)) || null;
  const hasSampleSets = sampleSets.length > 0;

  return (
    <div className="page-surface">
      {loading ? (
        <main className="dashboard-grid dashboard-grid-intro">
          <Panel className="dashboard-intro-panel" style={{ gridColumn: "1 / -1" }}>
            <EmptyState>Loading dashboard...</EmptyState>
          </Panel>
        </main>
      ) : !hasSampleSets ? (
        <main className="dashboard-grid dashboard-grid-intro">
          <DashboardIntro onNavigateFileManagement={onNavigateFileManagement} />
        </main>
      ) : (
        <main className="dashboard-grid">
          <SampleSetsPanel
            sampleSets={sampleSets}
            selectedSampleSetId={selectedSampleSetId}
            onSelectSampleSet={onSelectSampleSet}
            onDeleteSampleSet={onDeleteSampleSet}
          />
          <div className="main-area">
            {sampleSetAnalyticsLoading ? (
              <Panel>
                <EmptyState className="dashboard-analytics-empty-state">Loading analytics...</EmptyState>
              </Panel>
            ) : selectedSampleSet ? (
              <SampleSetAnalyticsPanel
                workflow={selectedSampleSet}
                sampleSet={selectedSampleSet}
                sampleSetAnalytics={sampleSetAnalytics}
                analyticsLoading={false}
                analyticsError=""
                onDeleteWorkflow={onDeleteWorkflow}
              />
            ) : (
              <Panel>
                <EmptyState className="dashboard-analytics-empty-state">
                  Please select a sample set to view analytics.
                </EmptyState>
              </Panel>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
