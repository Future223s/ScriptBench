"use client";

import { FileManagementPageView } from "../../../components/file-management/FileManagementPageView.js";
import { useFileManagementPage } from "../../../hooks/file-management/useFileManagementPage.js";

export default function FileManagementRoute() {
  const fileManagement = useFileManagementPage();

  return (
    <FileManagementPageView
      state={fileManagement.state}
      actions={fileManagement.actions}
      uploadRefs={fileManagement.uploadRefs}
    />
  );
}
