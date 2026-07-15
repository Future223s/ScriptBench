"use client";

import { useState } from "react";

import { createArtifactBlobFormData, createSampleBlobFormData, fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { collectFolderFiles, collectGroundTruthFolderFiles, collectImageFolderFiles } from "../../utils/upload.js";
import { createEmptyFolderUploadProgress } from "./fileManagementShared.js";

function stripExtension(fileName) {
  return String(fileName || "").replace(/\.[^./]+$/, "");
}

function fileStem(fileName) {
  return stripExtension(String(fileName || "").split("/").pop() || "");
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function firstFolderSegment(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)[0] || "";
}

function deriveFolderOriginatingSampleId(item, explicitValue) {
  const explicit = String(explicitValue || "").trim();
  if (explicit) return explicit;
  const relativePath = String(item.file?.webkitRelativePath || item.file?.name || "");
  return firstFolderSegment(relativePath);
}

function artifactMapPayload(artifacts) {
  return artifacts.map((artifact) => ({
    artifact_id: artifact.artifact_id,
    artifact_name: artifact.artifact_name,
    originating_sample_id: artifact.originating_sample_id,
    artifact_mime_type: artifact.artifact_mime_type,
    artifact_category: artifact.artifact_category,
    artifact_group_id: artifact.artifact_group_id,
    artifact_group_name: artifact.artifact_group_name,
    artifact_blob_base64: artifact.artifact_blob_base64,
    artifact_blob_size: artifact.artifact_blob_size,
  }));
}

function artifactCreatePayload(artifacts) {
  return artifacts.map((artifact) => ({
    artifact_name: artifact.artifact_name,
    artifact_mime_type: artifact.artifact_mime_type,
    artifact_category: artifact.artifact_category,
    originating_sample_id: artifact.originating_sample_id,
    artifact_blob_base64: artifact.artifact_blob_base64,
  }));
}

function artifactPatchPayload(artifacts) {
  return artifacts.map((artifact) => ({
    artifact_id: artifact.artifact_id,
    artifact_group_id: artifact.artifact_group_id,
    artifact_group_name: artifact.artifact_group_name,
    originating_sample_id: artifact.originating_sample_id,
  }));
}

function createUploadDrafts() {
  return {
    sample: {
      sampleName: "",
      sampleFile: null,
      groundTruthText: "",
      sampleFolderFiles: [],
      groundTruthFolderFiles: [],
    },
    artifact: {
      artifactName: "",
      artifactFile: null,
      artifactFolderFiles: [],
      originatingSampleId: "",
    },
    asset: {
      assetName: "",
      assetFile: null,
      assetFolderFiles: [],
    },
  };
}

export function useFileUpload() {
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadType, setUploadTypeState] = useState("sample");
  const [uploadMode, setUploadModeState] = useState("single");
  const [uploadDrafts, setUploadDrafts] = useState(createUploadDrafts);
  const [uploadInputResetKey, setUploadInputResetKey] = useState(0);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [folderUploadProgress, setFolderUploadProgress] = useState(createEmptyFolderUploadProgress);

  function setUploadType(type) {
    setUploadTypeState(type === "artifact" || type === "asset" ? type : "sample");
  }

  function setUploadMode(mode) {
    setUploadModeState(mode === "folder" ? "folder" : "single");
  }

  function openUploadPanel() {
    setUploadPanelOpen(true);
  }

  function closeUploadPanel() {
    setUploadPanelOpen(false);
  }

  function setUploadField(field, value) {
    setUploadDrafts((current) => ({
      ...current,
      [uploadType]: {
        ...current[uploadType],
        [field]: value,
      },
    }));
  }

  function setUploadFiles(field, files) {
    const normalizedFiles = Array.isArray(files) ? files : files ? [files] : [];
    setUploadDrafts((current) => ({
      ...current,
      [uploadType]: {
        ...current[uploadType],
        [field]: normalizedFiles,
      },
    }));
  }

  function clearUploadDraft() {
    setUploadDrafts(createUploadDrafts());
    setUploadInputResetKey((current) => current + 1);
    setFolderUploadProgress(createEmptyFolderUploadProgress());
  }

  function startFolderUpload(totalFiles) {
    setFolderUploadProgress({
      totalFiles,
      completedFiles: 0,
      failedFiles: 0,
      currentFile: null,
    });
  }

  function markFolderUploadProgress({ fileName, completedFiles, failedFiles, totalFiles }) {
    setFolderUploadProgress({
      totalFiles,
      completedFiles,
      failedFiles,
      currentFile: fileName,
    });
  }

  async function submitUpload(effects) {
    try {
      setUploadLoading(true);
      const activeDraft = uploadDrafts[uploadType];
      let uploadHadFailures = false;
      let failureMessage = "";

      if (uploadType === "sample") {
        if (uploadMode === "folder") {
          const imageFiles = collectImageFolderFiles(activeDraft.sampleFolderFiles || []);
          let textFiles = new Map();
          if (activeDraft.groundTruthFolderFiles?.length) {
            textFiles = await collectGroundTruthFolderFiles(activeDraft.groundTruthFolderFiles);
          }

          if (!imageFiles.length) {
            throw new Error("The selected folder does not contain any supported sample files.");
          }
          startFolderUpload(imageFiles.length);
          for (let index = 0; index < imageFiles.length; index += 1) {
            const { file, sampleId } = imageFiles[index];
            const created = await fileManagementApi.createSample({
              sample_name: sampleId,
              sample_id: sampleId,
              ground_truth_text: textFiles.get(sampleId) || "",
            });
            await fileManagementApi.uploadSampleBlob(
              created.sample_id,
              createSampleBlobFormData(file),
            );
            markFolderUploadProgress({
              fileName: file.name || null,
              completedFiles: index + 1,
              failedFiles: 0,
              totalFiles: imageFiles.length,
            });
          }
        } else {
          const file = activeDraft.sampleFile?.[0] || null;
          if (!file) throw new Error("Select a sample file first.");

          const derivedName = activeDraft.sampleName.trim() || fileStem(file.name);
          const created = await fileManagementApi.createSample({
            sample_name: derivedName,
            sample_id: derivedName,
            ground_truth_text: activeDraft.groundTruthText.trim(),
          });
          await fileManagementApi.uploadSampleBlob(
            created.sample_id,
            createSampleBlobFormData(file),
          );
        }

        effects.setNotice(uploadMode === "folder" ? "Samples uploaded." : "Sample uploaded.");
      } else if (uploadType === "artifact") {
        if (uploadMode === "folder") {
          const folderFiles = collectFolderFiles(activeDraft.artifactFolderFiles || []);
          if (!folderFiles.length) {
            throw new Error("The selected folder does not contain any artifact files.");
          }
          startFolderUpload(folderFiles.length);
          const artifacts = folderFiles.map((item) => ({
            artifact_name: item.recordId || fileStem(item.file.name),
            artifact_mime_type: item.file.type || null,
            artifact_category: "companion",
            originating_sample_id: deriveFolderOriginatingSampleId(item, activeDraft.originatingSampleId) || null,
            artifact_blob_base64: null,
          }));
          const createPayload = await Promise.all(artifacts.map(async (artifact, index) => ({
            ...artifact,
            artifact_blob_base64: await fileToBase64(folderFiles[index].file),
          })));
          const created = await fileManagementApi.createArtifacts(artifactCreatePayload(createPayload));
          const createdArtifacts = created.data || [];
          const mappedResponse = await fileManagementApi.mapArtifacts(
            artifactMapPayload(createdArtifacts.map((artifact) => ({
              ...artifact,
              artifact_blob_base64: null,
            }))),
          );
          const mapped = mappedResponse.data?.mapped_artifacts || [];
          const failedMappings = mappedResponse.data?.rejected_artifacts || [];
          if (failedMappings.length) {
            const firstFailure = failedMappings[0];
            throw new Error(String(firstFailure?.reason || `Artifact mapping failed for ${firstFailure?.artifact_name || "artifact"}.`));
          }
          await fileManagementApi.patchArtifacts(artifactPatchPayload(mapped));
          await Promise.all((createdArtifacts || []).map((artifact, index) => fileManagementApi.uploadArtifactBlob(
            artifact.artifact_id,
            createArtifactBlobFormData(folderFiles[index].file, artifact.artifact_mime_type || artifacts[index].artifact_mime_type),
          )));
          markFolderUploadProgress({
            fileName: folderFiles.at(-1)?.file?.name || null,
            completedFiles: folderFiles.length,
            failedFiles: 0,
            totalFiles: folderFiles.length,
          });
        } else {
          const file = activeDraft.artifactFile?.[0] || null;
          if (!file) throw new Error("Select an artifact file first.");

          const derivedName = activeDraft.artifactName.trim() || fileStem(file.name);
          const artifacts = [
            {
              artifact_name: derivedName,
              artifact_mime_type: file.type || null,
              artifact_category: "companion",
              originating_sample_id: activeDraft.originatingSampleId.trim() || null,
              artifact_blob_base64: await fileToBase64(file),
            },
          ];
          const created = await fileManagementApi.createArtifacts(artifactCreatePayload(artifacts));
          const createdArtifact = created.data?.[0];
          if (!createdArtifact?.artifact_id) {
            throw new Error("Artifact metadata was created, but no artifact ID was returned.");
          }
          const mappedResponse = await fileManagementApi.mapArtifacts(
            artifactMapPayload([{
              ...createdArtifact,
              artifact_blob_base64: null,
            }]),
          );
          const mapped = mappedResponse.data?.mapped_artifacts || [];
          const failedMappings = mappedResponse.data?.rejected_artifacts || [];
          if (failedMappings.length) {
            const firstFailure = failedMappings[0];
            throw new Error(String(firstFailure?.reason || `Artifact mapping failed for ${derivedName}.`));
          }
          await fileManagementApi.patchArtifacts(artifactPatchPayload(mapped));
          await fileManagementApi.uploadArtifactBlob(
            createdArtifact.artifact_id,
            createArtifactBlobFormData(file, artifacts[0].artifact_mime_type),
          );
        }

        effects.setNotice(uploadMode === "folder" ? "Artifacts queued for upload." : "Artifact queued for upload.");
      } else {
        if (uploadMode === "folder") {
          const folderFiles = collectFolderFiles(activeDraft.assetFolderFiles || []);
          if (!folderFiles.length) {
            throw new Error("The selected folder does not contain any asset files.");
          }
          startFolderUpload(folderFiles.length);
          for (let index = 0; index < folderFiles.length; index += 1) {
            const item = folderFiles[index];
            const derivedName = item.recordId || fileStem(item.file.name);
            const created = await fileManagementApi.createAsset({
              asset_name: derivedName,
              asset_type: item.file.type || "application/octet-stream",
            });
            const formData = new FormData();
            formData.append("file", item.file);
            await fileManagementApi.uploadAssetBlob(created.asset_id, formData);
            markFolderUploadProgress({
              fileName: item.file.name || null,
              completedFiles: index + 1,
              failedFiles: 0,
              totalFiles: folderFiles.length,
            });
          }
        } else {
          const file = activeDraft.assetFile?.[0] || null;
          if (!file) throw new Error("Select an asset file first.");

          const derivedName = activeDraft.assetName.trim() || fileStem(file.name);
          const created = await fileManagementApi.createAsset({
            asset_name: derivedName,
            asset_type: file.type || "application/octet-stream",
          });
          const formData = new FormData();
          formData.append("file", file);
          await fileManagementApi.uploadAssetBlob(created.asset_id, formData);
        }

        effects.setNotice(uploadMode === "folder" ? "Assets uploaded." : "Asset uploaded.");
      }

      await effects.refresh();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));

      effects.setError(uploadHadFailures ? failureMessage : "");
      setUploadPanelOpen(false);
      clearUploadDraft();
    } catch (error) {
      effects.setError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploadLoading(false);
    }
  }

  return {
    state: {
      uploadPanelOpen,
      uploadType,
      uploadMode,
      uploadDraft: uploadDrafts[uploadType],
      uploadDrafts,
      uploadInputResetKey,
      uploadLoading,
      folderUploadProgress,
    },
    actions: {
      openUploadPanel,
      closeUploadPanel,
      setUploadType,
      setUploadMode,
      setUploadField,
      setUploadFiles,
      clearUploadDraft,
      submitUpload,
    },
  };
}
