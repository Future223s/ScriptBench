"use client";

function filesFromEvent(event) {
  return Array.from(event.target.files || []);
}

function UploadTypeToggle({ uploadType, setUploadType }) {
  return (
    <div className="mode-switch">
      <button
        className={["mode-option", uploadType === "sample" ? "is-active" : ""].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setUploadType("sample")}
      >
        Samples
      </button>
      <button
        className={["mode-option", uploadType === "artifact" ? "is-active" : ""].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setUploadType("artifact")}
      >
        Artifacts
      </button>
      <button
        className={["mode-option", uploadType === "asset" ? "is-active" : ""].filter(Boolean).join(" ")}
        type="button"
        onClick={() => setUploadType("asset")}
      >
        Assets
      </button>
    </div>
  );
}

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

function SampleUploadFields({ isFolderUpload, draft, actions, resetKey }) {
  return (
    <>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="sample-name">Sample name</label>
        <input
          id="sample-name"
          name="sample_name"
          placeholder="page_001"
          value={draft.sampleName}
          onChange={(event) => actions.setUploadField("sampleName", event.target.value)}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="sample-file">File</label>
        <input
          key={`sample-file-${resetKey}`}
          id="sample-file"
          name="file"
          type="file"
          onChange={(event) => actions.setUploadFiles("sampleFile", filesFromEvent(event))}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="sample-ground-truth">Ground truth text</label>
        <textarea
          id="sample-ground-truth"
          name="ground_truth_text"
          rows="7"
          placeholder="Optional transcription or reference text."
          value={draft.groundTruthText}
          onChange={(event) => actions.setUploadField("groundTruthText", event.target.value)}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
        <label htmlFor="sample-folder">Folder of sample files</label>
        <input
          key={`sample-folder-${resetKey}`}
          id="sample-folder"
          name="sample_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) => actions.setUploadFiles("sampleFolderFiles", filesFromEvent(event))}
        />
        <span className="count-label">Choose the folder that contains the sample files.</span>
      </div>
      <div className={["field", "wide", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
        <label htmlFor="sample-ground-truth-folder">Folder of ground-truth text files</label>
        <input
          key={`sample-ground-truth-folder-${resetKey}`}
          id="sample-ground-truth-folder"
          name="ground_truth_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) => actions.setUploadFiles("groundTruthFolderFiles", filesFromEvent(event))}
        />
        <span className="count-label">Ground-truth files should use the same relative name as the sample file.</span>
      </div>
    </>
  );
}

function ArtifactUploadFields({ isFolderUpload, draft, actions, resetKey, samples }) {
  const sampleOptions = samples.length
    ? samples.map((sample) => ({
        value: sample.sample_id,
        label: sample.sample_name || sample.sample_id,
      }))
    : [];

  return (
    <>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="artifact-name">Artifact name</label>
        <input
          id="artifact-name"
          name="artifact_name"
          placeholder="page_001_crop_01"
          value={draft.artifactName}
          onChange={(event) => actions.setUploadField("artifactName", event.target.value)}
        />
      </div>
      <div className="field wide">
        <label htmlFor="artifact-originating-sample">Originating sample</label>
        <select
          id="artifact-originating-sample"
          name="originating_sample_id"
          value={draft.originatingSampleId}
          onChange={(event) => actions.setUploadField("originatingSampleId", event.target.value)}
          disabled={!sampleOptions.length}
        >
          <option value="">{sampleOptions.length ? "Let artifact mapping resolve this" : "No samples available"}</option>
          {sampleOptions.map((sample) => (
            <option key={sample.value} value={sample.value}>
              {sample.label}
            </option>
          ))}
        </select>
        <span className="count-label">Optional fallback hint. The backend mapping rules determine the final source sample.</span>
      </div>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="artifact-file">File</label>
        <input
          key={`artifact-file-${resetKey}`}
          id="artifact-file"
          name="file"
          type="file"
          onChange={(event) => actions.setUploadFiles("artifactFile", filesFromEvent(event))}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
        <label htmlFor="artifact-folder">Folder of artifact files</label>
        <input
          key={`artifact-folder-${resetKey}`}
          id="artifact-folder"
          name="artifact_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) => actions.setUploadFiles("artifactFolderFiles", filesFromEvent(event))}
        />
        <span className="count-label">Folder uploads will derive artifact names from the folder structure when possible.</span>
      </div>
    </>
  );
}

function AssetUploadFields({ isFolderUpload, draft, actions, resetKey }) {
  return (
    <>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="asset-name">Asset name</label>
        <input
          id="asset-name"
          name="asset_name"
          placeholder="reference_image"
          value={draft.assetName}
          onChange={(event) => actions.setUploadField("assetName", event.target.value)}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "is-hidden" : ""].filter(Boolean).join(" ")}>
        <label htmlFor="asset-file">File</label>
        <input
          key={`asset-file-${resetKey}`}
          id="asset-file"
          name="file"
          type="file"
          onChange={(event) => actions.setUploadFiles("assetFile", filesFromEvent(event))}
        />
      </div>
      <div className={["field", "wide", isFolderUpload ? "" : "is-hidden"].filter(Boolean).join(" ")}>
        <label htmlFor="asset-folder">Folder of asset files</label>
        <input
          key={`asset-folder-${resetKey}`}
          id="asset-folder"
          name="asset_folder_files"
          type="file"
          webkitdirectory=""
          multiple
          onChange={(event) => actions.setUploadFiles("assetFolderFiles", filesFromEvent(event))}
        />
        <span className="count-label">Asset names default to the file name when no explicit name is provided.</span>
      </div>
    </>
  );
}

export function FileUploadPanel({ state, actions }) {
  const isFolderUpload = state.uploadMode === "folder";
  const uploadDraft = state.uploadDraft || {};
  const resetKey = state.uploadInputResetKey || 0;
  const progress = state.folderUploadProgress || {};
  const showProgress = isFolderUpload && (progress.totalFiles || state.uploadLoading);

  function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    void actions.submitUpload();
  }

  return (
    <form
      className="file-upload-form file-upload-form--modal"
      onSubmit={handleSubmit}
    >
      <div className="file-upload-copy">
        {state.uploadType === "sample" ? (
          <p>Sample uploads support single-file and folder inputs, with optional ground-truth text.</p>
        ) : state.uploadType === "artifact" ? (
          <p>Artifact uploads are mapped by backend group and sample rules before they are saved.</p>
        ) : (
          <p>Asset uploads stay lightweight: use a name only when needed.</p>
        )}
      </div>
      <UploadTypeToggle uploadType={state.uploadType} setUploadType={actions.setUploadType} />
      <UploadModeToggle uploadMode={state.uploadMode} setUploadMode={actions.setUploadMode} />
      <div className="form-grid">
        {state.uploadType === "sample" ? (
          <SampleUploadFields isFolderUpload={isFolderUpload} draft={uploadDraft} actions={actions} resetKey={resetKey} />
        ) : state.uploadType === "artifact" ? (
          <ArtifactUploadFields isFolderUpload={isFolderUpload} draft={uploadDraft} actions={actions} resetKey={resetKey} samples={state.samples} />
        ) : (
          <AssetUploadFields isFolderUpload={isFolderUpload} draft={uploadDraft} actions={actions} resetKey={resetKey} />
        )}
      </div>
      {showProgress ? (
        <div className="file-upload-copy">
          <p>
            {progress.completedFiles || 0} of {progress.totalFiles || 0} uploaded
            {progress.failedFiles ? `, ${progress.failedFiles} failed` : ""}.
          </p>
          {progress.currentFile ? <p>Current file: {progress.currentFile}</p> : null}
        </div>
      ) : null}
      <div className="inline-actions file-upload-actions">
        <button className="btn-primary" type="submit" onClick={handleSubmit} disabled={state.uploadLoading}>
          {state.uploadLoading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </form>
  );
}
