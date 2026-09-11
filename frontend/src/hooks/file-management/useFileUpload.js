"use client";

import { useState } from "react";

import {
  createDerivativeBlobFormData,
  createSampleBlobFormData,
  fileManagementApi,
} from "../../api/endpoints/fileManagement.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import {
  collectFolderFiles,
  collectGroundTruthFolderFiles,
  collectImageFolderFiles,
} from "../../utils/upload.js";
import { createEmptyFolderUploadProgress } from "./fileManagementShared.js";

function stripExtension(fileName) {
  return String(fileName || "").replace(/\.[^./]+$/, "");
}

function fileStem(fileName) {
  return stripExtension(
    String(fileName || "")
      .split("/")
      .pop() || "",
  );
}

function derivativeMapPayload(derivatives) {
  return derivatives.map((derivative) => ({
    id: derivative.id,
    name: derivative.name,
  }));
}

function derivativeCreatePayload(derivatives) {
  return derivatives.map((derivative) => ({
    name: derivative.name,
    mime_type: derivative.mime_type,
  }));
}

function derivativePatchPayload(derivatives) {
  return derivatives.map((derivative) => ({
    id: derivative.id,
    derivative_group_id: derivative.derivative_group_id,
    sample_id: derivative.sample_id,
    category: derivative.category,
    mime_type: derivative.mime_type,
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
    derivative: {
      derivativeName: "",
      derivativeFile: null,
      derivativeFolderFiles: [],
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
  const [folderUploadProgress, setFolderUploadProgress] = useState(
    createEmptyFolderUploadProgress,
  );

  function setUploadType(type) {
    setUploadTypeState(
      type === "derivative" || type === "asset" ? type : "sample",
    );
  }

  function setUploadMode(mode) {
    setUploadModeState(mode === "folder" ? "folder" : "single");
  }

  function openUploadPanel(type = "sample") {
    setUploadType(type);
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

  function markFolderUploadProgress({
    fileName,
    completedFiles,
    failedFiles,
    totalFiles,
  }) {
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
          const imageFiles = collectImageFolderFiles(
            activeDraft.sampleFolderFiles || [],
          );
          let textFiles = new Map();
          if (activeDraft.groundTruthFolderFiles?.length) {
            textFiles = await collectGroundTruthFolderFiles(
              activeDraft.groundTruthFolderFiles,
            );
          }

          if (!imageFiles.length) {
            throw new Error(
              "The selected folder does not contain any supported sample files.",
            );
          }
          startFolderUpload(imageFiles.length);
          for (let index = 0; index < imageFiles.length; index += 1) {
            const { file, sampleId } = imageFiles[index];
            const created = await fileManagementApi.createSample({
              name: sampleId,
              id: sampleId,
              ground_truth_text: textFiles.get(sampleId) || "",
            });
            await fileManagementApi.uploadSampleBlob(
              created.id,
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

          const derivedName =
            activeDraft.sampleName.trim() || fileStem(file.name);
          const created = await fileManagementApi.createSample({
            name: derivedName,
            id: derivedName,
            ground_truth_text: activeDraft.groundTruthText.trim(),
          });
          await fileManagementApi.uploadSampleBlob(
            created.id,
            createSampleBlobFormData(file),
          );
        }

        effects.setNotice(
          uploadMode === "folder" ? "Samples uploaded." : "Sample uploaded.",
        );
      } else if (uploadType === "derivative") {
        if (uploadMode === "folder") {
          const folderFiles = collectFolderFiles(
            activeDraft.derivativeFolderFiles || [],
          );
          if (!folderFiles.length) {
            throw new Error(
              "The selected folder does not contain any derivative files.",
            );
          }
          startFolderUpload(folderFiles.length);
          const derivatives = folderFiles.map((item) => ({
            name: item.recordId || fileStem(item.file.name),
            mime_type: item.file.type || null,
          }));
          const created = await fileManagementApi.createDerivatives(
            derivativeCreatePayload(derivatives),
          );
          const createdDerivatives = created.data || [];
          for (let index = 0; index < createdDerivatives.length; index += 1) {
            const derivative = createdDerivatives[index];
            const folderFile = folderFiles[index];
            await fileManagementApi.uploadDerivativeBlob(
              derivative.id,
              createDerivativeBlobFormData(
                folderFile.file,
                derivatives[index].mime_type,
              ),
            );
            markFolderUploadProgress({
              fileName: folderFile.file.name || null,
              completedFiles: index + 1,
              failedFiles: 0,
              totalFiles: folderFiles.length,
            });
          }
          const mappedResponse = await fileManagementApi.mapDerivatives(
            derivativeMapPayload(createdDerivatives),
          );
          const mapped = mappedResponse.data?.mapped_derivatives || [];
          const failedMappings = mappedResponse.data?.rejected_derivatives || [];
          if (failedMappings.length) {
            const firstFailure = failedMappings[0];
            throw new Error(
              String(
                firstFailure?.reason ||
                  `Derivative mapping failed for ${firstFailure?.name || "derivative"}.`,
              ),
            );
          }
          await fileManagementApi.patchDerivatives(derivativePatchPayload(mapped));
        } else {
          const file = activeDraft.derivativeFile?.[0] || null;
          if (!file) throw new Error("Select an derivative file first.");

          const derivedName =
            activeDraft.derivativeName.trim() || fileStem(file.name);
          const derivatives = [
            {
              name: derivedName,
              mime_type: file.type || null,
            },
          ];
          const created = await fileManagementApi.createDerivatives(
            derivativeCreatePayload(derivatives),
          );
          const createdDerivative = created.data?.[0];
          if (!createdDerivative?.id) {
            throw new Error(
              "Derivative metadata was created, but no derivative ID was returned.",
            );
          }
          await fileManagementApi.uploadDerivativeBlob(
            createdDerivative.id,
            createDerivativeBlobFormData(file, derivatives[0].mime_type),
          );
          const mappedResponse = await fileManagementApi.mapDerivatives(
            derivativeMapPayload([createdDerivative]),
          );
          const mapped = mappedResponse.data?.mapped_derivatives || [];
          const failedMappings = mappedResponse.data?.rejected_derivatives || [];
          if (failedMappings.length) {
            const firstFailure = failedMappings[0];
            throw new Error(
              String(
                firstFailure?.reason ||
                  `Derivative mapping failed for ${derivedName}.`,
              ),
            );
          }
          await fileManagementApi.patchDerivatives(derivativePatchPayload(mapped));
        }

        effects.setNotice(
          uploadMode === "folder"
            ? "Derivatives queued for upload."
            : "Derivative queued for upload.",
        );
      } else {
        if (uploadMode === "folder") {
          const folderFiles = collectFolderFiles(
            activeDraft.assetFolderFiles || [],
          );
          if (!folderFiles.length) {
            throw new Error(
              "The selected folder does not contain any asset files.",
            );
          }
          startFolderUpload(folderFiles.length);
          for (let index = 0; index < folderFiles.length; index += 1) {
            const item = folderFiles[index];
            const derivedName = item.recordId || fileStem(item.file.name);
            const created = await fileManagementApi.createAsset({
              name: derivedName,
              type: item.file.type || "application/octet-stream",
            });
            const formData = new FormData();
            formData.append("file", item.file);
            await fileManagementApi.uploadAssetBlob(created.id, formData);
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

          const derivedName =
            activeDraft.assetName.trim() || fileStem(file.name);
          const created = await fileManagementApi.createAsset({
            name: derivedName,
            type: file.type || "application/octet-stream",
          });
          const formData = new FormData();
          formData.append("file", file);
          await fileManagementApi.uploadAssetBlob(created.id, formData);
        }

        effects.setNotice(
          uploadMode === "folder" ? "Assets uploaded." : "Asset uploaded.",
        );
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
