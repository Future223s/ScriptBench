"use client";

import { FileUploadPanel } from "./FileUploadPanel.js";
import { FileManagementOverlays } from "./FileManagementOverlays.js";
import { SampleManagementPanel } from "./SampleManagementPanel.js";

export function FileManagementPageView({
  state,
  actions,
  uploadRefs,
}) {
  return (
    <div className="page-surface file-management-page">
      <section className="file-management-grid">
        <FileUploadPanel uploadMode={state.uploadMode} actions={actions} uploadRefs={uploadRefs} />
        <SampleManagementPanel state={state} actions={actions} />
      </section>
      <FileManagementOverlays state={state} actions={actions} />
    </div>
  );
}
