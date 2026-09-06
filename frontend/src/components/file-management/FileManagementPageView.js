"use client";

import { FileManagementOverlays } from "./FileManagementOverlays.js";
import { SampleManagementPanel } from "./SampleManagementPanel.js";
import { ResourceCollectionsPanel } from "./ResourceCollectionsPanel.js";
import { managementModes } from "../../hooks/file-management/fileManagementShared.js";
import { Button, SegmentedControl } from "../../ui/primitives/index.js";

export function FileManagementPageView({ state, actions }) {
  return (
    <div className="page-surface file-management-page">
      <header className="file-management-page__header">
        <div>
          <h1>File Management</h1>
        </div>
        <SegmentedControl
          items={Object.entries(managementModes).map(([id, item]) => ({
            id,
            label: item.title,
          }))}
          value={state.managementType}
          onChange={actions.setManagementType}
        />
        <Button variant="primary" onClick={actions.openUploadPanel}>
          Upload files
        </Button>
      </header>
      <section
        className={`file-management-grid${state.managementType === "asset" ? " file-management-grid--single" : ""}`}
      >
        <SampleManagementPanel state={state} actions={actions} />
        {state.managementType !== "asset" ? (
          <ResourceCollectionsPanel state={state} actions={actions} />
        ) : null}
      </section>
      <FileManagementOverlays state={state} actions={actions} />
    </div>
  );
}
