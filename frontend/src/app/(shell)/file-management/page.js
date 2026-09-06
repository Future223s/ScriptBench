"use client";

import { FileManagementPageView } from "../../../components/file-management/FileManagementPageView.js";
import { useFileManagementPage } from "../../../hooks/file-management/useFileManagementPage.js";
import { useResourceCatalogPage } from "../../../hooks/resources/useResourceCatalogPage.js";

export default function FileManagementRoute() {
  const fileManagement = useFileManagementPage();
  const resourceCatalog = useResourceCatalogPage();

  const resourceActions = {
    ...resourceCatalog.actions,
    submitCreateSampleSet: async (...args) => {
      const result = await resourceCatalog.actions.submitCreateSampleSet(
        ...args,
      );
      await fileManagement.actions.refresh();
      return result;
    },
    submitCreateArtifactGroup: async (...args) => {
      const result = await resourceCatalog.actions.submitCreateArtifactGroup(
        ...args,
      );
      await fileManagement.actions.refresh();
      return result;
    },
  };

  return (
    <FileManagementPageView
      state={{
        ...fileManagement.state,
        workflowResourceState: resourceCatalog.state,
      }}
      actions={{
        ...fileManagement.actions,
        workflowResourceActions: resourceActions,
      }}
    />
  );
}
