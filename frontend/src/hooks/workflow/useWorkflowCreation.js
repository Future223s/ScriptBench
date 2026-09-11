"use client";

import { useEffect, useState } from "react";

import { workflowBuilderApi } from "../../api/endpoints/workflowBuilder.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import {
  buildWorkflowPayload,
  defaultWorkflowDraft,
} from "../../utils/workflow.js";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";

function createInitialState() {
  return {
    open: false,
    wizardStep: 0,
    workflowDraft: defaultWorkflowDraft(),
    sampleSets: [],
    error: "",
    notice: "",
    submitting: false,
  };
}

function cloneDefaultDraft() {
  return defaultWorkflowDraft();
}

export function useWorkflowCreation() {
  const [state, setState] = useState(createInitialState);
  const { syncNotifications } = useNotificationOverlay() || {};

  async function loadSampleSets() {
    try {
      const response = await workflowBuilderApi.getSampleSets();
      setState((current) => ({
        ...current,
        sampleSets: response.items || [],
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        sampleSets: [],
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  function openWorkflowWizard() {
    setState((current) => ({
      ...current,
      open: true,
      wizardStep: 0,
      workflowDraft: cloneDefaultDraft(),
      submitting: false,
      error: "",
      notice: "",
    }));
    void loadSampleSets();
  }

  function closeWorkflowWizard() {
    setState((current) => ({
      ...current,
      open: false,
      submitting: false,
    }));
  }

  function setWorkflowDraftField(field, value) {
    setState((current) => ({
      ...current,
      workflowDraft: {
        ...current.workflowDraft,
        [field]: value,
      },
    }));
  }

  function setWorkflowSampleSet(sampleSetId) {
    setState((current) => {
      const nextSampleSetId = Number(sampleSetId) || null;
      return {
        ...current,
        workflowDraft: {
          ...current.workflowDraft,
          sample_set_id: nextSampleSetId,
        },
      };
    });
  }

  function nextWorkflowStep() {
    setState((current) => {
      if (
        current.wizardStep === 0 &&
        !String(current.workflowDraft.name || "").trim()
      ) {
        return {
          ...current,
          error: "Workflow name is required.",
        };
      }
      if (current.wizardStep === 1 && !current.workflowDraft.sample_set_id) {
        return {
          ...current,
          error: "Sample set is required.",
        };
      }

      return {
        ...current,
        wizardStep: Math.min(1, current.wizardStep + 1),
        error: "",
      };
    });
  }

  function previousWorkflowStep() {
    setState((current) => ({
      ...current,
      wizardStep: Math.max(0, current.wizardStep - 1),
    }));
  }

  async function submitWorkflow() {
    setState((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const payload = buildWorkflowPayload(state.workflowDraft);
      if (!payload.sample_set_id) {
        setState((current) => ({
          ...current,
          submitting: false,
          error: "Sample set is required.",
        }));
        return;
      }

      await workflowBuilderApi.createWorkflow(payload);
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
      setState((current) => ({
        ...current,
        open: false,
        wizardStep: 0,
        workflowDraft: cloneDefaultDraft(),
        submitting: false,
        error: "",
        notice: "Workflow created.",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        submitting: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  useEffect(() => {
    void loadSampleSets();

    function handleDataChanged() {
      void loadSampleSets();
    }

    window.addEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      window.removeEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("workflow-creation-hook", [
      { kind: "error", message: state.error },
      { kind: "success", message: state.notice },
    ]);
  }, [syncNotifications, state.error, state.notice]);

  return {
    state,
    actions: {
      openWorkflowWizard,
      closeWorkflowWizard,
      setWorkflowDraftField,
      setWorkflowSampleSet,
      nextWorkflowStep,
      previousWorkflowStep,
      submitWorkflow,
    },
  };
}
