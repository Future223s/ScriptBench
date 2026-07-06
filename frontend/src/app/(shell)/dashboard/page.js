"use client";

import { useRouter } from "next/navigation";

import { DashboardPageView } from "../../../components/dashboard/DashboardPageView.js";
import { useDashboardPage } from "../../../hooks/dashboard/useDashboardPage.js";

export default function DashboardRoute() {
  const router = useRouter();
  const dashboard = useDashboardPage();

  return (
    <DashboardPageView
      loading={dashboard.loading}
      sampleSets={dashboard.sampleSets}
      selectedSampleSetId={dashboard.selectedSampleSetId}
      sampleSetAnalytics={dashboard.sampleSetAnalytics}
      sampleSetAnalyticsLoading={dashboard.sampleSetAnalyticsLoading}
      onSelectSampleSet={dashboard.selectSampleSet}
      onDeleteSampleSet={dashboard.removeSampleSet}
      onDeleteWorkflow={dashboard.removeWorkflow}
      onNavigateFileManagement={() => router.push("/file-management")}
    />
  );
}
