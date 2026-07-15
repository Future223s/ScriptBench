"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Modal } from "../common/Modal.js";
import { FileUploadPanel } from "./FileUploadPanel.js";
import { ManagementFields } from "./SampleManagementPanel.js";
import { managementModes, objectTypeLabel, visibleRecordsForType } from "../../hooks/file-management/fileManagementShared.js";

function RecordDetailModal({ open, type, record, actions }) {
  const mimeType = record?.mimeType || "";
  const blobBase64 = record?.blobBase64 || "";
  const src = blobBase64 && mimeType && String(mimeType).startsWith("image/")
    ? `data:${mimeType};base64,${blobBase64}`
    : "";
  const metaRows = record?.metadata || [];
  const isSample = type === "sample";
  const isAsset = type === "asset";
  const additionalMetadata = record?.additionalMetadata || [];
  const detailSections = record?.detailSections || [];

  return (
    <div className={["modal-backdrop", open ? "" : "is-hidden"].filter(Boolean).join(" ")} data-modal="file-detail">
      <section className="modal">
        <div className="modal-header">
          <div className="panel-title">
            <h2>{record?.name || "Record"}</h2>
            <span>{mimeType || record?.typeLabel || type}</span>
          </div>
          <div className="inline-actions">
            <button className="btn-danger" type="button" onClick={() => actions.deleteRecord(type, record?.id)} disabled={!record?.id}>
              Delete
            </button>
            <button className="btn-ghost" type="button" onClick={actions.closeRecordDetail}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="sample-detail-grid">
            <div className="sample-preview">
              {actions.detailLoading ? (
                <EmptyState>Loading record details...</EmptyState>
              ) : src ? (
                <img src={src} alt={record?.name || "Record preview"} />
              ) : (
                <EmptyState>No image preview available.</EmptyState>
              )}
            </div>
            {isAsset ? (
              <div className="ground-truth-box">
                <h3>Details</h3>
                <div className="metadata-grid">
                  {metaRows.map(([label, value]) => (
                    <div className="metadata-row" key={label}>
                      <span>{label}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))}
                </div>
                {detailSections.map((section) => (
                  <div key={section.title}>
                    <h3>{section.title}</h3>
                    <pre>{section.content || ""}</pre>
                  </div>
                ))}
                {additionalMetadata.length ? (
                  <>
                    <h3>Metadata</h3>
                    <div className="metadata-grid">
                      {additionalMetadata.map(([label, value]) => (
                        <div className="metadata-row" key={label}>
                          <span>{label}</span>
                          <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="ground-truth-box">
                {isSample ? (
                  <>
                    <h3>Ground truth</h3>
                    <pre>{record?.groundTruthText || ""}</pre>
                    {metaRows.length ? (
                      <>
                        <h3>Details</h3>
                        <div className="metadata-grid">
                          {metaRows.map(([label, value]) => (
                            <div className="metadata-row" key={label}>
                              <span>{label}</span>
                              <strong>{String(value)}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {additionalMetadata.length ? (
                      <>
                        <h3>Metadata</h3>
                        <div className="metadata-grid">
                          {additionalMetadata.map(([label, value]) => (
                            <div className="metadata-row" key={label}>
                              <span>{label}</span>
                              <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h3>Details</h3>
                    <div className="metadata-grid">
                      {metaRows.map(([label, value]) => (
                        <div className="metadata-row" key={label}>
                          <span>{label}</span>
                          <strong>{String(value)}</strong>
                        </div>
                      ))}
                    </div>
                    {detailSections.map((section) => (
                      <div key={section.title}>
                        <h3>{section.title}</h3>
                        <pre>{section.content || ""}</pre>
                      </div>
                    ))}
                    {additionalMetadata.length ? (
                      <>
                        <h3>Metadata</h3>
                        <div className="metadata-grid">
                          {additionalMetadata.map(([label, value]) => (
                            <div className="metadata-row" key={label}>
                              <span>{label}</span>
                              <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ManagementModal({ open, state, actions }) {
  const type = managementModes[state.managementType] ? state.managementType : "sample";
  const mode = managementModes[type];
  const visibleRecords = visibleRecordsForType(state, type);
  const selectedIds = state.selections[type] || [];
  const selectedCount = selectedIds.length;
  const visibleCount = visibleRecords.length;
  const recordLabel = objectTypeLabel(type).toLowerCase();
  const primaryLabel = mode.createLabel || mode.deleteLabel;
  const summary =
    type === "asset" && !selectedCount
      ? `Select one or more ${recordLabel} on the page before deleting them.`
      : selectedCount
        ? `${selectedCount} selected ${recordLabel} will be used.`
        : `${visibleCount} visible ${recordLabel} will be used.`;

  return (
    <Modal
      open={open}
      panelClassName="file-management-modal"
      data-modal="file-management"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeManagementModal();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>{primaryLabel}</h2>
          <span>{mode.title}</span>
        </div>
        <button className="btn-ghost" type="button" onClick={actions.closeManagementModal}>
          Close
        </button>
      </div>
      <form
        id="file-management-modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.submitManagement(mode.createAction || "delete");
        }}
      >
        <div className="modal-body file-management-modal-body">
          <div className="mode-copy">
            <strong>{mode.title}</strong>
            <p>{mode.description}</p>
            <p className="mode-hint">{summary}</p>
          </div>
          {type === "asset" ? (
            <EmptyState className="file-management-modal-empty">
              Asset deletion uses the current selection. If nothing is selected, the action stays disabled.
            </EmptyState>
          ) : (
            <ManagementFields type={type} draft={state.drafts} actions={actions} />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" type="button" onClick={actions.closeManagementModal}>
            Cancel
          </button>
          <button className={type === "asset" ? "btn-danger" : "btn-primary"} type="submit" disabled={type === "asset" && !selectedCount}>
            {primaryLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UploadModal({ open, state, actions }) {
  const modeLabel =
    state.uploadType === "artifact"
      ? "Artifacts"
      : state.uploadType === "asset"
        ? "Assets"
        : "Samples";

  return (
    <Modal
      open={open}
      panelClassName="file-upload-modal"
      data-modal="file-upload"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeUploadPanel();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Upload files</h2>
          <span>{modeLabel}</span>
        </div>
        <button className="btn-ghost" type="button" onClick={actions.closeUploadPanel}>
          Close
        </button>
      </div>
      <div className="modal-body file-upload-modal-body">
        <FileUploadPanel state={state} actions={actions} />
      </div>
    </Modal>
  );
}

export function FileManagementOverlays({ state, actions }) {
  return (
    <>
      <RecordDetailModal
        open={state.detailOpen}
        type={state.detailType || "sample"}
        record={state.selectedRecord}
        actions={{ ...actions, detailLoading: state.detailLoading }}
      />
      <ManagementModal open={state.managementModalOpen} state={state} actions={actions} />
      <UploadModal open={state.uploadPanelOpen} state={state} actions={actions} />
    </>
  );
}
