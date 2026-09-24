"use client";

import { Instruction } from "../../ui/primitives/index.js";

function filesFromEvent(event) {
  return Array.from(event.target.files || []);
}

function DocumentUploadFields({ isFolderUpload, draft, actions, resetKey }) {
  return (
    <>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="document-name">Document name</label>
        <input
          id="document-name"
          name="name"
          placeholder="EMMO-La115"
          value={draft.documentName}
          onChange={(event) =>
            actions.setUploadField("documentName", event.target.value)
          }
        />
        <Instruction>
          Document names cannot contain underscores. Pages use document_page.
        </Instruction>
      </div>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="document-file">PDF</label>
        <input
          key={`document-file-${resetKey}`}
          id="document-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) =>
            actions.setUploadFiles("documentFile", filesFromEvent(event))
          }
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
        <label htmlFor="document-folder">Folder of PDFs</label>
        <input
          key={`document-folder-${resetKey}`}
          id="document-folder"
          name="document_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) =>
            actions.setUploadFiles("documentFolderFiles", filesFromEvent(event))
          }
        />
      </div>
    </>
  );
}

function SampleUploadFields({ isFolderUpload, draft, actions, resetKey }) {
  return (
    <>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="sample-name">Sample name</label>
        <input
          id="sample-name"
          name="name"
          placeholder="page_001"
          value={draft.sampleName}
          onChange={(event) =>
            actions.setUploadField("sampleName", event.target.value)
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="sample-file">File</label>
        <input
          key={`sample-file-${resetKey}`}
          id="sample-file"
          name="file"
          type="file"
          onChange={(event) =>
            actions.setUploadFiles("sampleFile", filesFromEvent(event))
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="sample-ground-truth">Ground truth text</label>
        <textarea
          id="sample-ground-truth"
          name="ground_truth_text"
          rows="7"
          placeholder="Optional transcription or reference text."
          value={draft.groundTruthText}
          onChange={(event) =>
            actions.setUploadField("groundTruthText", event.target.value)
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "" : "is-hidden"]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="sample-folder">Folder of sample files</label>
        <input
          key={`sample-folder-${resetKey}`}
          id="sample-folder"
          name="sample_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) =>
            actions.setUploadFiles("sampleFolderFiles", filesFromEvent(event))
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "" : "is-hidden"]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="sample-ground-truth-folder">
          Folder of ground-truth text files
        </label>
        <input
          key={`sample-ground-truth-folder-${resetKey}`}
          id="sample-ground-truth-folder"
          name="ground_truth_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) =>
            actions.setUploadFiles(
              "groundTruthFolderFiles",
              filesFromEvent(event),
            )
          }
        />
        <Instruction>
          Ground-truth files should use the same relative name as the sample
          file.
        </Instruction>
        <Instruction>
          Page names must use document_page, or _page when no document exists.
          Document membership and page order are assigned automatically.
        </Instruction>
      </div>
    </>
  );
}

function DerivativeUploadFields({
  isFolderUpload,
  draft,
  actions,
  resetKey,
}) {
  return (
    <>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="derivative-name">Derivative name</label>
        <input
          id="derivative-name"
          name="name"
          placeholder="page_001_crop_01"
          value={draft.derivativeName}
          onChange={(event) =>
            actions.setUploadField("derivativeName", event.target.value)
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="derivative-file">File</label>
        <input
          key={`derivative-file-${resetKey}`}
          id="derivative-file"
          name="file"
          type="file"
          onChange={(event) =>
            actions.setUploadFiles("derivativeFile", filesFromEvent(event))
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "" : "is-hidden"]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="derivative-folder">Folder of derivative files</label>
        <input
          key={`derivative-folder-${resetKey}`}
          id="derivative-folder"
          name="derivative_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) =>
            actions.setUploadFiles("derivativeFolderFiles", filesFromEvent(event))
          }
        />
        <Instruction>
          Names must use document_page_derivative or _page_derivative. The
          source sample and derivative group are assigned automatically.
        </Instruction>
      </div>
    </>
  );
}

function AssetUploadFields({ isFolderUpload, draft, actions, resetKey }) {
  return (
    <>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="asset-name">Asset name</label>
        <input
          id="asset-name"
          name="name"
          placeholder="reference_image"
          value={draft.assetName}
          onChange={(event) =>
            actions.setUploadField("assetName", event.target.value)
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "is-hidden" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="asset-file">File</label>
        <input
          key={`asset-file-${resetKey}`}
          id="asset-file"
          name="file"
          type="file"
          onChange={(event) =>
            actions.setUploadFiles("assetFile", filesFromEvent(event))
          }
        />
      </div>
      <div
        className={["field", "wide", isFolderUpload ? "" : "is-hidden"]
          .filter(Boolean)
          .join(" ")}
      >
        <label htmlFor="asset-folder">Folder of asset files</label>
        <input
          key={`asset-folder-${resetKey}`}
          id="asset-folder"
          name="asset_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) =>
            actions.setUploadFiles("assetFolderFiles", filesFromEvent(event))
          }
        />
        <Instruction>
          Asset names default to the file name when no explicit name is
          provided.
        </Instruction>
      </div>
    </>
  );
}

export function FileUploadPanel({ state, actions, formId }) {
  const isFolderUpload = state.uploadMode === "folder";
  const uploadDraft = state.uploadDraft || {};
  const resetKey = state.uploadInputResetKey || 0;
  const progress = state.folderUploadProgress || {};
  const showProgress =
    isFolderUpload && (progress.totalFiles || state.uploadLoading);

  function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    void actions.submitUpload();
  }

  return (
    <form
      id={formId}
      className="file-upload-form file-upload-form--modal"
      onSubmit={handleSubmit}
    >
      <div className="form-grid">
        {state.uploadType === "document" ? (
          <DocumentUploadFields
            isFolderUpload={isFolderUpload}
            draft={uploadDraft}
            actions={actions}
            resetKey={resetKey}
          />
        ) : state.uploadType === "sample" ? (
          <SampleUploadFields
            isFolderUpload={isFolderUpload}
            draft={uploadDraft}
            actions={actions}
            resetKey={resetKey}
          />
        ) : state.uploadType === "derivative" ? (
          <DerivativeUploadFields
            isFolderUpload={isFolderUpload}
            draft={uploadDraft}
            actions={actions}
            resetKey={resetKey}
          />
        ) : (
          <AssetUploadFields
            isFolderUpload={isFolderUpload}
            draft={uploadDraft}
            actions={actions}
            resetKey={resetKey}
          />
        )}
      </div>
      {showProgress ? (
        <div className="file-upload-copy">
          <p>
            {progress.completedFiles || 0} of {progress.totalFiles || 0}{" "}
            uploaded
            {progress.failedFiles ? `, ${progress.failedFiles} failed` : ""}.
          </p>
          {progress.currentFile ? (
            <p>Current file: {progress.currentFile}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
