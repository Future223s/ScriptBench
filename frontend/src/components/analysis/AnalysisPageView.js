"use client";

import { AnalysisBrowser } from "../dashboard/AnalysisBrowser.js";
import { WorkflowDisagreementWorkspace } from "./WorkflowDisagreementWorkspace.js";
import { PageHeader, Stack } from "../../ui/primitives/index.js";

export function AnalysisPageView({ loading, loadingMore, analysis, error }) {
  return (
    <div className="page-surface">
      <main className="analysis-page">
        <Stack>
          <PageHeader
            title="Analysis"
            description="Explore transcriptions and trace disagreements across workflow steps."
          />
          <AnalysisBrowser
            analysis={analysis}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
          />
          <WorkflowDisagreementWorkspace />
        </Stack>
      </main>
    </div>
  );
}
