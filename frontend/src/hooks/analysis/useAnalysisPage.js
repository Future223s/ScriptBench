"use client";

import { useEffect, useState } from "react";

import { dashboardApi } from "../../api/endpoints/dashboard.ts";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";
import { emptyAnalysis, mergeAnalysisChunk } from "./analysisShared.js";

const ANALYSIS_CHUNK_SIZE = 100;

export function useAnalysisPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [state, setState] = useState({
    loading: true,
    loadingMore: false,
    error: "",
    analysis: null,
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadAnalysis() {
      let cursor = null;
      let analysis = emptyAnalysis();
      try {
        while (active) {
          const chunk = await dashboardApi.getGlobalAnalysis({
            cursor,
            limit: ANALYSIS_CHUNK_SIZE,
            signal: controller.signal,
          });
          if (!active) return;
          analysis = mergeAnalysisChunk(analysis, chunk);
          const loadingMore = chunk.has_more && chunk.next_cursor != null;
          setState({
            loading: false,
            loadingMore,
            error: "",
            analysis,
          });
          if (!loadingMore) return;
          if (chunk.next_cursor === cursor) {
            throw new Error("Analysis pagination did not advance");
          }
          cursor = chunk.next_cursor;
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }

    loadAnalysis();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;
    syncNotifications("analysis-page", [
      { kind: "error", message: state.error },
    ]);
    return () => syncNotifications("analysis-page", []);
  }, [syncNotifications, state.error]);

  return state;
}
