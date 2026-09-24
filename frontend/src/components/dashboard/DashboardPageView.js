"use client";

import {
  EmptyState,
  Icon,
  IconButton,
  LoadingPlaceholder,
  PageHeader,
  Panel,
  StackedSelect,
} from "../../ui/primitives/index.js";
import { DashboardIntro } from "./DashboardIntro.js";
import { SampleSetAnalyticsPanel } from "./SampleSetAnalyticsPanel.js";

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
          <PageHeader
            title="Sample Set Dashboard"
            description="Review sample coverage and workflow performance."
            controls={
              <StackedSelect
                label="Sample set"
                value={selectedSampleSetId || ""}
                onChange={(event) =>
                  onSelectSampleSet?.(Number(event.target.value))
                }
              >
                {sampleSets.map((sampleSet) => (
                  <option key={sampleSet.id} value={sampleSet.id}>
                    {sampleSet.name || `Sample set ${sampleSet.id}`}
                  </option>
                ))}
              </StackedSelect>
            }
            actions={
              selectedSampleSet ? (
                <IconButton
                  label={`Delete sample set ${selectedSampleSet.name || selectedSampleSet.id}`}
                  variant="danger"
                  onClick={() => onDeleteSampleSet?.(Number(selectedSampleSet.id))}
                >
                  <Icon name="delete" />
                </IconButton>
              ) : null
            }
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
