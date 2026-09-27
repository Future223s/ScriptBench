"use client";

import {
  Button,
  CodeBlock,
  DescriptionList,
  Dialog,
  EmptyState,
  ImageFrame,
  Inline,
  SectionTitle,
  SegmentedControl,
  SplitPane,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { FileUploadPanel } from "./FileUploadPanel.js";
import { ManagementFields } from "./SampleManagementPanel.js";
import { WorkflowStepsOverlays } from "../workflow-steps/WorkflowStepsOverlays.js";
import {
  managementModes,
  objectTypeLabel,
  visibleRecordsForType,
} from "../../hooks/file-management/fileManagementShared.js";

function decodeBase64Text(value) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "Unable to decode text preview.";
  }
}

function stringifyRows(rows = []) {
  return rows.map(([label, value]) => [
    label,
    typeof value === "object" ? JSON.stringify(value) : String(value),
  ]);
}

function RecordDetails({ type, record }) {
  const metaRows = stringifyRows(record?.metadata || []);
  const additionalMetadata = stringifyRows(record?.additionalMetadata || []);
  const detailRows = [...metaRows, ...additionalMetadata];
  const detailSections = record?.detailSections || [];
  return (
    <Stack>
      {type === "sample" ? (
        <>
          <SectionTitle>Ground truth</SectionTitle>
          <CodeBlock>{record?.groundTruthText || "No ground truth available."}</CodeBlock>
        </>
      ) : null}
      {detailRows.length ? (
        <>
          <SectionTitle>Details</SectionTitle>
          <DescriptionList items={detailRows} />
        </>
      ) : null}
      {detailSections.map((section) => (
        <CodeBlock key={section.title} label={section.title}>
          {section.content || ""}
        </CodeBlock>
      ))}
    </Stack>
  );
}

function RecordPreview({ type, record, loading }) {
  if (loading) return <EmptyState title="Loading record details" />;
  const mimeType = String(record?.mimeType || "");
  const blobBase64 = record?.blobBase64 || "";
  const assetType = String(record?.assetType || "").toLowerCase();
  const isImage = mimeType.toLowerCase().startsWith("image/") || assetType === "image";
  const isText = mimeType.toLowerCase().startsWith("text/") || assetType === "text";
  if (type === "document" && blobBase64) {
    return <iframe className="file-detail-document" title={record?.name || "Document preview"} src={`data:application/pdf;base64,${blobBase64}`} />;
  }
  if (isImage && blobBase64) {
    return <ImageFrame variant="zoomable" src={`data:${mimeType};base64,${blobBase64}`} alt={record?.name || "Record preview"} caption={record?.name || "Image preview"} />;
  }
  if (isText && blobBase64) {
    return <CodeBlock label="Preview">{decodeBase64Text(blobBase64)}</CodeBlock>;
  }
  return <EmptyState title="No preview available">This record does not contain previewable content.</EmptyState>;
}

export function RecordDetailDialog({ open, type, record, actions }) {
  const isDocument = type === "document";
  const canAssembleDocument = isDocument && typeof actions.assembleDocument === "function";
  const canDelete = typeof actions.deleteRecord === "function";
  const dialogActions = canAssembleDocument || canDelete ? (
    <Inline gap="compact">
      {canAssembleDocument ? <Button size="compact" onClick={() => actions.assembleDocument(record?.id)} disabled={!record?.id || !record?.raw?.sample_count}>Assemble PDF</Button> : null}
      {canDelete ? <Button size="compact" variant="danger" onClick={() => actions.deleteRecord(type, record?.id)} disabled={!record?.id}>Delete</Button> : null}
    </Inline>
  ) : null;
  return (
    <Dialog
      open={open}
      title={record?.name || "Record"}
      description={record?.mimeType || record?.typeLabel || objectTypeLabel(type)}
      size="extra-wide"
      onClose={actions.closeRecordDetail}
      actions={dialogActions}
    >
      <SplitPane
        primary={<RecordPreview type={type} record={record} loading={actions.detailLoading} />}
        secondary={<RecordDetails type={type} record={record} />}
      />
    </Dialog>
  );
}

function ManagementDialog({ open, state, actions }) {
  const type = managementModes[state.managementType] ? state.managementType : "sample";
  const mode = managementModes[type];
  const visibleRecords = visibleRecordsForType(state, type);
  const selectedIds = state.selections[type] || [];
  const selectedCount = selectedIds.length;
  const recordLabel = objectTypeLabel(type).toLowerCase();
  const primaryLabel = mode.createLabel || mode.deleteLabel;
  const summary = selectedCount
    ? `${selectedCount} selected ${recordLabel} will be used.`
    : `${visibleRecords.length} visible ${recordLabel} will be used.`;
  return (
    <Dialog
      open={open}
      title={primaryLabel}
      description={summary}
      onClose={actions.closeManagementModal}
      footer={
        <Inline gap="compact" justify="end">
          <Button onClick={actions.closeManagementModal}>Cancel</Button>
          <Button type="submit" form="file-management-modal-form" variant={type === "asset" ? "danger" : "primary"} disabled={type === "asset" && !selectedCount}>{primaryLabel}</Button>
        </Inline>
      }
    >
      <form id="file-management-modal-form" onSubmit={(event) => { event.preventDefault(); void actions.submitManagement(mode.createAction || "delete"); }}>
        <Stack>
          <StatusBadge>{mode.title}</StatusBadge>
          {type === "asset" ? <EmptyState title="Select assets first">Asset deletion uses the current catalog selection.</EmptyState> : <ManagementFields type={type} draft={state.drafts} actions={actions} />}
        </Stack>
      </form>
    </Dialog>
  );
}

function UploadDialog({ open, state, actions }) {
  const modeLabel = state.uploadType === "document" ? "Documents" : state.uploadType === "derivative" ? "Derivatives" : state.uploadType === "asset" ? "Assets" : "Samples";
  return (
    <Dialog
      open={open}
      title={`Upload ${modeLabel}`}
      description={`Add ${modeLabel.toLowerCase()} to the Library.`}
      size="wide"
      onClose={actions.closeUploadPanel}
      footer={<Button type="submit" form="file-upload-form" variant="primary" disabled={state.uploadLoading}>{state.uploadLoading ? "Uploading…" : `Upload ${modeLabel}`}</Button>}
    >
      <Stack>
        <SegmentedControl items={[{ id: "single", label: "Single file" }, { id: "folder", label: "Folder" }]} value={state.uploadMode} onChange={actions.setUploadMode} />
        <FileUploadPanel state={state} actions={actions} formId="file-upload-form" />
      </Stack>
    </Dialog>
  );
}

export function FileManagementOverlays({ state, actions }) {
  return <>
    <RecordDetailDialog open={state.detailOpen} type={state.detailType || "sample"} record={state.selectedRecord} actions={{ ...actions, detailLoading: state.detailLoading }} />
    <ManagementDialog open={state.managementModalOpen} state={state} actions={actions} />
    <UploadDialog open={state.uploadPanelOpen} state={state} actions={actions} />
    {state.workflowStepsState && actions.workflowStepsActions ? <WorkflowStepsOverlays state={state.workflowStepsState} actions={actions.workflowStepsActions} /> : null}
  </>;
}
