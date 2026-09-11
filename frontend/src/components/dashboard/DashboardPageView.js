"use client";

import {
  EmptyState,
  LoadingPlaceholder,
  Panel,
} from "../../ui/primitives/index.js";
import { DashboardIntro } from "./DashboardIntro.js";
import { SampleSetAnalyticsPanel } from "./SampleSetAnalyticsPanel.js";
import { SampleSetsPanel } from "./SampleSetsPanel.js";

export function DashboardPageView({
  loading,
  sampleSets,
  selectedSampleSetId,
  sampleSetAnalytics,
  sampleSetAnalyticsLoading,
  sampleSetAnalyticsError,
  onSelectSampleSet,
  onDeleteSampleSet,
  onDeleteWorkflow,
  onNavigateFileManagement,
}) {
  const selectedSampleSet =
    sampleSets.find(
      (sampleSet) =>
        Number(sampleSet.id) === Number(selectedSampleSetId),
    ) || null;
  const hasSampleSets = sampleSets.length > 0;

  return (
    <div className="page-surface">
      {loading ? (
        <main className="dashboard-page">
          <Panel title="Dashboard">
            <LoadingPlaceholder label="Loading dashboard" />
          </Panel>
        </main>
      ) : !hasSampleSets ? (
        <main className="dashboard-page dashboard-page--empty">
          <DashboardIntro onNavigateFileManagement={onNavigateFileManagement} />
        </main>
      ) : (
        <main className="dashboard-page">
          <SampleSetsPanel
            sampleSets={sampleSets}
            selectedSampleSetId={selectedSampleSetId}
            onSelectSampleSet={onSelectSampleSet}
            onDeleteSampleSet={onDeleteSampleSet}
          />
          <div className="main-area">
            {sampleSetAnalyticsLoading ? (
              <Panel title="Analytics">
                <LoadingPlaceholder label="Loading analytics" />
              </Panel>
            ) : selectedSampleSet ? (
              <SampleSetAnalyticsPanel
                workflow={selectedSampleSet}
                sampleSet={selectedSampleSet}
                sampleSetAnalytics={sampleSetAnalytics}
                analyticsLoading={false}
                analyticsError={sampleSetAnalyticsError}
                onDeleteWorkflow={onDeleteWorkflow}
              />
            ) : (
              <Panel title="Analytics">
                <EmptyState title="Select a sample set">
                  Choose a set from the list to view its analytics.
                </EmptyState>
              </Panel>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
