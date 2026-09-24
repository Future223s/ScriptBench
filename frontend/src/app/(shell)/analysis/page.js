"use client";

import { AnalysisPageView } from "../../../components/analysis/AnalysisPageView.js";
import { useAnalysisPage } from "../../../hooks/analysis/useAnalysisPage.js";

export default function AnalysisRoute() {
  const analysis = useAnalysisPage();
  return (
    <AnalysisPageView
      loading={analysis.loading}
      loadingMore={analysis.loadingMore}
      analysis={analysis.analysis}
      error={analysis.error}
    />
  );
}
