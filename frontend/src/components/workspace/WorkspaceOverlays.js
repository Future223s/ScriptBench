"use client";

import { JobDetailModal } from "./JobDetailModal.js";

export function WorkspaceOverlays({ state, actions }) {
  return <JobDetailModal open={state.jobDetailOpen} job={state.selectedJob} onClose={actions?.closeJobDetail} />;
}
