"use client";

import { useState } from "react";

import { fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { normalizeManagementType, normalizeRecordPreview, recordIdToString } from "./fileManagementShared.js";

export function useFileDetail({ setError }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function closeRecordDetail() {
    setDetailOpen(false);
    setDetailType(null);
    setSelectedRecord(null);
    setDetailLoading(false);
  }

  async function openRecord(type, recordId) {
    try {
      setDetailLoading(true);
      setSelectedRecord(null);
      const normalizedId = recordIdToString(recordId);
      const normalizedType = normalizeManagementType(type);
      const record =
        normalizedType === "artifact"
          ? (await fileManagementApi.getArtifact(normalizedId)).data
          : normalizedType === "asset"
            ? await fileManagementApi.getAsset(normalizedId)
            : await fileManagementApi.getSample(normalizedId);

      setSelectedRecord(normalizeRecordPreview(normalizedType, record));
      setDetailType(normalizedType);
      setDetailOpen(true);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailLoading(false);
    }
  }

  return {
    state: {
      detailOpen,
      detailType,
      selectedRecord,
      detailLoading,
    },
    actions: {
      openRecord,
      closeRecordDetail,
    },
  };
}
