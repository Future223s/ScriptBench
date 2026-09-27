"use client";

import { EmptyState, LoadingPlaceholder, Panel } from "../../ui/primitives/index.js";
import { DashboardIntro } from "./DashboardIntro.js";
import { SampleSetAnalyticsPanel } from "./SampleSetAnalyticsPanel.js";
import { RecordDetailDialog } from "../file-management/FileManagementOverlays.js";

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
  detailState,
  onOpenSampleDetail,
  onCloseSampleDetail,
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
          <div className="main-area">
            {sampleSetAnalyticsLoading ? (
              <Panel title="Analytics">
                <LoadingPlaceholder label="Loading analytics" />
              </Panel>
            ) : selectedSampleSet ? (
              <SampleSetAnalyticsPanel
                sampleSets={sampleSets}
                selectedSampleSetId={selectedSampleSetId}
                sampleSet={selectedSampleSet}
                sampleSetAnalytics={sampleSetAnalytics}
                analyticsLoading={false}
                analyticsError={sampleSetAnalyticsError}
                onDeleteWorkflow={onDeleteWorkflow}
                onSelectSampleSet={onSelectSampleSet}
                onManageSampleSet={onNavigateFileManagement}
                onOpenSampleDetail={onOpenSampleDetail}
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
      <RecordDetailDialog
        open={Boolean(detailState?.detailOpen)}
        type="sample"
        record={detailState?.selectedRecord}
        actions={{
          closeRecordDetail: onCloseSampleDetail,
          detailLoading: Boolean(detailState?.detailLoading),
        }}
      />
    </div>
  );
}
