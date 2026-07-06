"use client";

import { useEffect, useState } from "react";

import { dashboardApi } from "../../api/endpoints/dashboard.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { buildWorkflowPayload, defaultBatchItemSchemaEntries, defaultWorkflowDraft } from "../../utils/workflow.js";
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
  return {
    ...defaultWorkflowDraft(),
    item_schema_entries: defaultBatchItemSchemaEntries().map((entry) => ({ ...entry })),
  };
}

export function useWorkflowCreation() {
  const [state, setState] = useState(createInitialState);
  const { syncNotifications } = useNotificationOverlay() || {};

  async function loadSampleSets() {
    try {
      const response = await dashboardApi.getSampleSets();
      setState((current) => ({
        ...current,
        sampleSets: response.sample_sets || [],
      }));
    } catch {
      setState((current) => ({
        ...current,
        sampleSets: [],
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
      const sampleSet = current.sampleSets.find((item) => Number(item.sample_set_id) === nextSampleSetId) || null;

      return {
        ...current,
        workflowDraft: {
          ...current.workflowDraft,
          sample_set_id: nextSampleSetId,
          sample_ids: Array.isArray(sampleSet?.sample_ids) ? [...sampleSet.sample_ids] : [],
        },
      };
    });
  }

  function setWorkflowInputMode(value) {
    setState((current) => {
      const inputMode = value === "single" ? "single" : "batch";
      const nextDraft = {
        ...current.workflowDraft,
        input_mode: inputMode,
        output_format_type: inputMode === "single" ? "plain_text" : "json_array",
      };

      if (inputMode === "batch") {
        const entries = Array.isArray(nextDraft.item_schema_entries) ? nextDraft.item_schema_entries : [];
        const hasAnyContent = entries.some((entry) => String(entry?.field || "").trim() || String(entry?.description || "").trim());
        if (!hasAnyContent) {
          nextDraft.item_schema_entries = defaultBatchItemSchemaEntries().map((entry) => ({ ...entry }));
        }
      }

      if (inputMode === "single" && nextDraft.sample_ids.length > 1) {
        nextDraft.sample_ids = nextDraft.sample_ids.slice(0, 1);
      }

      return {
        ...current,
        workflowDraft: nextDraft,
      };
    });
  }

  function nextWorkflowStep() {
    setState((current) => {
      if (current.wizardStep === 0 && !String(current.workflowDraft.workflow_name || "").trim()) {
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
        wizardStep: Math.min(2, current.wizardStep + 1),
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

  function addWorkflowExample() {
    setState((current) => ({
      ...current,
      workflowDraft: {
        ...current.workflowDraft,
        examples: [...current.workflowDraft.examples, { title: "", instruction_text: "", assets: "" }],
      },
    }));
  }

  function removeWorkflowExample(index) {
    setState((current) => {
      const examples = [...current.workflowDraft.examples];
      examples.splice(index, 1);
      if (!examples.length) {
        examples.push({ title: "", instruction_text: "", assets: "" });
      }

      return {
        ...current,
        workflowDraft: {
          ...current.workflowDraft,
          examples,
        },
      };
    });
  }

  function addWorkflowSchemaField() {
    setState((current) => ({
      ...current,
      workflowDraft: {
        ...current.workflowDraft,
        item_schema_entries: [...current.workflowDraft.item_schema_entries, { field: "", description: "" }],
      },
    }));
  }

  function removeWorkflowSchemaField(index) {
    setState((current) => {
      const itemSchemaEntries = [...current.workflowDraft.item_schema_entries];
      itemSchemaEntries.splice(index, 1);
      if (!itemSchemaEntries.length) {
        itemSchemaEntries.push({ field: "", description: "" });
      }

      return {
        ...current,
        workflowDraft: {
          ...current.workflowDraft,
          item_schema_entries: itemSchemaEntries,
        },
      };
    });
  }

  async function submitWorkflow() {
    setState((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      const payload = buildWorkflowPayload(state.workflowDraft, state.sampleSets);
      if (!payload.sample_set_id) {
        setState((current) => ({
          ...current,
          submitting: false,
          error: "Sample set is required.",
        }));
        return;
      }

      await dashboardApi.createWorkflow(payload);
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
      setWorkflowInputMode,
      nextWorkflowStep,
      previousWorkflowStep,
      addWorkflowExample,
      removeWorkflowExample,
      addWorkflowSchemaField,
      removeWorkflowSchemaField,
      submitWorkflow,
    },
  };
}
