"use client";

import { FileManagementOverlays } from "./FileManagementOverlays.js";
import { SampleManagementPanel } from "./SampleManagementPanel.js";
import { managementModes } from "../../hooks/file-management/fileManagementShared.js";

export function FileManagementPageView({
  state,
  actions,
}) {
  return (
    <div className="page-surface file-management-page">
      <header className="file-management-page-header">
        <div className="file-management-page-header-copy">
          <div className="file-management-page-title">File Management</div>
        </div>
        <div className="file-management-page-header-center" role="tablist" aria-label="File management mode">
          {Object.entries(managementModes).map(([key, item]) => (
            <button
              key={key}
              className={["mode-option", key === state.managementType ? "is-active" : ""].filter(Boolean).join(" ")}
              type="button"
              onClick={() => actions.setManagementType(key)}
              aria-pressed={key === state.managementType}
            >
              {item.title}
            </button>
          ))}
        </div>
        <button className="btn-primary btn-tight file-management-upload-button" type="button" onClick={actions.openUploadPanel}>
          Upload files
        </button>
      </header>
      <section className="file-management-grid">
        <SampleManagementPanel state={state} actions={actions} />
      </section>
      <FileManagementOverlays state={state} actions={actions} />
    </div>
  );
}
