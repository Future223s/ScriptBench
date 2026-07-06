"use client";

import { Panel } from "../common/Panel.js";

function UploadModeToggle({ uploadMode, setUploadMode }) {
  const isFolderUpload = uploadMode === "folder";

  return (
    <div className="mode-switch">
      <button
        className={["mode-option", isFolderUpload ? "" : "is-active"].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setUploadMode("single")}
      >
        Single file
      </button>
      <button
        className={["mode-option", isFolderUpload ? "is-active" : ""].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setUploadMode("folder")}
      >
        Folder
      </button>
    </div>
  );
}

export function FileUploadPanel({ uploadMode, actions, uploadRefs }) {
  const isFolderUpload = uploadMode === "folder";

  return (
    <Panel className="file-upload-panel">
      <div className="panel-header">
        <div className="panel-title">
          <h2>Upload files</h2>
          <span>Source samples land here first</span>
        </div>
      </div>
      <form
        className="file-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          void actions.submitUpload();
        }}
      >
        <UploadModeToggle uploadMode={uploadMode} setUploadMode={actions.setUploadMode} />
        <div className="file-upload-copy">
          <p>Use single file uploads for one-off samples and folder uploads for uploading a batch all at once.</p>
        </div>
        <div className="form-grid">
          <div className={["field", "wide", "upload-single-field", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
            <label htmlFor="upload-sample-id">Sample ID</label>
            <input ref={uploadRefs.sampleId} id="upload-sample-id" name="sample_id" placeholder="page_001" />
          </div>
          <div className={["field", "wide", "upload-single-field", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
            <label htmlFor="upload-file">File</label>
            <input ref={uploadRefs.file} id="upload-file" name="file" type="file" />
          </div>
          <div className={["field", "wide", "upload-single-field", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
            <label htmlFor="upload-ground-truth">Ground truth text</label>
            <textarea ref={uploadRefs.groundTruth} id="upload-ground-truth" name="ground_truth_text" rows="7" placeholder="Optional transcription or reference text." />
          </div>
          <div className={["field", "wide", "upload-folder-field", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
            <label htmlFor="upload-image-folder">Folder of images</label>
            <input ref={uploadRefs.imageFolder} id="upload-image-folder" name="image_folder_files" type="file" webkitdirectory="" multiple />
            <span className="count-label">Choose the folder containing the image files.</span>
          </div>
          <div className={["field", "wide", "upload-folder-field", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
            <label htmlFor="upload-ground-truth-folder">Folder of ground truth text files</label>
            <input ref={uploadRefs.groundTruthFolder} id="upload-ground-truth-folder" name="ground_truth_folder_files" type="file" webkitdirectory="" multiple />
            <span className="count-label">Ground truth files should be named like the image they match, with <code>_gt</code> appended.</span>
          </div>
        </div>
        <div className="inline-actions file-upload-actions">
          <button className="btn-primary" type="submit">
            Upload
          </button>
        </div>
      </form>
    </Panel>
  );
}
