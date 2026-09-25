"use client";

import { FileManagementOverlays } from "./FileManagementOverlays.js";
import { SampleManagementPanel } from "./SampleManagementPanel.js";
import { managementModes } from "../../hooks/file-management/fileManagementShared.js";
import {
  Button,
  PageHeader,
  SegmentedControl,
} from "../../ui/primitives/index.js";

export function FileManagementPageView({ state, actions }) {
  return (
    <div
      className="page-surface file-management-page"
      data-ui-theme="dashboard"
    >
      <PageHeader
        title="Library"
        description="Store and upload documents, samples, derivatives, and assets."
        controls={
          <SegmentedControl
            items={Object.entries(managementModes).map(([id, item]) => ({
              id,
              label: item.title,
            }))}
            value={state.managementType}
            onChange={actions.setManagementType}
          />
        }
        actions={
          <Button variant="primary" onClick={actions.openUploadPanel}>
            Upload files
          </Button>
        }
      />
      <section className="file-management-grid file-management-grid--single">
        <SampleManagementPanel state={state} actions={actions} />
      </section>
      <FileManagementOverlays state={state} actions={actions} />
    </div>
  );
}
