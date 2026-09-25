"use client";

import {
  Field,
  Grid,
  Instruction,
  Stack,
  StatusBadge,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

function filesFromEvent(event) {
  return Array.from(event.target.files || []);
}

function FileField({ label, name, accept, multiple = false, folder = false, resetKey, onFiles }) {
  return (
    <Field label={label}>
      <TextInput
        key={`${name}-${resetKey}`}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        webkitdirectory={folder ? "" : undefined}
        onChange={(event) => onFiles(filesFromEvent(event))}
      />
    </Field>
  );
}

function DocumentUploadFields({ folder, draft, actions, resetKey }) {
  if (folder) {
    return <FileField label="Folder of PDFs" name="document_folder_files" accept="application/pdf,.pdf" multiple folder resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("documentFolderFiles", files)} />;
  }
  return <>
    <Field label="Document name" hint="Document names cannot contain underscores. Pages use document_page.">
      <TextInput name="name" placeholder="EMMO-La115" value={draft.documentName} onChange={(event) => actions.setUploadField("documentName", event.target.value)} />
    </Field>
    <FileField label="PDF" name="file" accept="application/pdf,.pdf" resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("documentFile", files)} />
  </>;
}

function SampleUploadFields({ folder, draft, actions, resetKey }) {
  if (folder) {
    return <>
      <FileField label="Folder of sample files" name="sample_folder_files" multiple folder resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("sampleFolderFiles", files)} />
      <Field label="Folder of ground-truth text files" hint="Ground-truth files should use the same relative name as the sample file.">
        <TextInput key={`ground-truth-folder-${resetKey}`} name="ground_truth_folder_files" type="file" webkitdirectory="" multiple onChange={(event) => actions.setUploadFiles("groundTruthFolderFiles", filesFromEvent(event))} />
      </Field>
      <Instruction>Page names must use document_page, or _page when no document exists. Document membership and page order are assigned automatically.</Instruction>
    </>;
  }
  return <>
    <Field label="Sample name"><TextInput name="name" placeholder="page_001" value={draft.sampleName} onChange={(event) => actions.setUploadField("sampleName", event.target.value)} /></Field>
    <FileField label="File" name="file" resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("sampleFile", files)} />
    <Field label="Ground truth text"><Textarea name="ground_truth_text" placeholder="Optional transcription or reference text." value={draft.groundTruthText} onChange={(event) => actions.setUploadField("groundTruthText", event.target.value)} /></Field>
  </>;
}

function DerivativeUploadFields({ folder, draft, actions, resetKey }) {
  if (folder) {
    return <Field label="Folder of derivative files" hint="Names must use document_page_derivative or _page_derivative. The source sample and derivative group are assigned automatically.">
      <TextInput key={`derivative-folder-${resetKey}`} name="derivative_folder_files" type="file" webkitdirectory="" multiple onChange={(event) => actions.setUploadFiles("derivativeFolderFiles", filesFromEvent(event))} />
    </Field>;
  }
  return <>
    <Field label="Derivative name"><TextInput name="name" placeholder="page_001_crop_01" value={draft.derivativeName} onChange={(event) => actions.setUploadField("derivativeName", event.target.value)} /></Field>
    <FileField label="File" name="file" resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("derivativeFile", files)} />
  </>;
}

function AssetUploadFields({ folder, draft, actions, resetKey }) {
  if (folder) {
    return <Field label="Folder of asset files" hint="Asset names default to the file name when no explicit name is provided.">
      <TextInput key={`asset-folder-${resetKey}`} name="asset_folder_files" type="file" webkitdirectory="" multiple onChange={(event) => actions.setUploadFiles("assetFolderFiles", filesFromEvent(event))} />
    </Field>;
  }
  return <>
    <Field label="Asset name"><TextInput name="name" placeholder="reference_image" value={draft.assetName} onChange={(event) => actions.setUploadField("assetName", event.target.value)} /></Field>
    <FileField label="File" name="file" resetKey={resetKey} onFiles={(files) => actions.setUploadFiles("assetFile", files)} />
  </>;
}

export function FileUploadPanel({ state, actions, formId }) {
  const folder = state.uploadMode === "folder";
  const draft = state.uploadDraft || {};
  const resetKey = state.uploadInputResetKey || 0;
  const progress = state.folderUploadProgress || {};
  const fields = state.uploadType === "document"
    ? <DocumentUploadFields folder={folder} draft={draft} actions={actions} resetKey={resetKey} />
    : state.uploadType === "sample"
      ? <SampleUploadFields folder={folder} draft={draft} actions={actions} resetKey={resetKey} />
      : state.uploadType === "derivative"
        ? <DerivativeUploadFields folder={folder} draft={draft} actions={actions} resetKey={resetKey} />
        : <AssetUploadFields folder={folder} draft={draft} actions={actions} resetKey={resetKey} />;
  return (
    <form id={formId} onSubmit={(event) => { event.preventDefault(); void actions.submitUpload(); }}>
      <Stack>
        <Grid columns={2}>{fields}</Grid>
        {folder && (progress.totalFiles || state.uploadLoading) ? (
          <Stack gap="compact">
            <StatusBadge>{progress.completedFiles || 0} of {progress.totalFiles || 0} uploaded</StatusBadge>
            {progress.failedFiles ? <Instruction>{progress.failedFiles} failed.</Instruction> : null}
            {progress.currentFile ? <Instruction>Current file: {progress.currentFile}</Instruction> : null}
          </Stack>
        ) : null}
      </Stack>
    </form>
  );
}
