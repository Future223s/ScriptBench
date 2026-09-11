"use client";

import { useState } from "react";

import { workflowStepsApi } from "../../api/endpoints/workflowSteps.ts";
import {
  DEFAULT_FILTERS,
  cloneFilters,
  createSampleFilterConfig,
  visibleRecordsForType,
} from "../file-management/fileManagementShared.js";

function createDraft() {
  return {
    name: "",
    description: "",
    sampleIds: [],
  };
}

export function useSampleSetCreation({
  samples,
  sampleSets,
  onCreated,
  setError,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(createDraft);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS.sample }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    ...DEFAULT_FILTERS.sample,
  }));

  const visibleSamples = visibleRecordsForType(
    { samples, sampleSets, appliedFilters: { sample: appliedFilters } },
    "sample",
  );

  function setSampleFilterField(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applySampleFilters() {
    setAppliedFilters({ ...filters });
  }

  function clearSampleFilters() {
    const defaults = cloneFilters(DEFAULT_FILTERS).sample;
    setFilters({ ...defaults });
    setAppliedFilters({ ...defaults });
  }

  function openCreateSampleSet() {
    setError("");
    setDraft(createDraft());
    setOpen(true);
  }

  function closeCreateSampleSet() {
    if (!loading) setOpen(false);
  }

  function updateCreateSampleSetField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleSampleSetSample(sampleId) {
    const normalizedId = String(sampleId);
    setDraft((current) => {
      const selected = current.sampleIds.includes(normalizedId);
      return {
        ...current,
        sampleIds: selected
          ? current.sampleIds.filter((id) => id !== normalizedId)
          : [...current.sampleIds, normalizedId],
      };
    });
  }

  function toggleAllVisibleSampleSetSamples() {
    const visibleIds = visibleSamples.map((sample) => String(sample.id));
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((sampleId) => draft.sampleIds.includes(sampleId));
    setDraft((current) => ({
      ...current,
      sampleIds: allVisibleSelected
        ? current.sampleIds.filter((sampleId) => !visibleIds.includes(sampleId))
        : [
            ...current.sampleIds,
            ...visibleIds.filter(
              (sampleId) => !current.sampleIds.includes(sampleId),
            ),
          ],
    }));
  }

  async function submitCreateSampleSet() {
    if (!draft.name.trim()) {
      setError("Sample set name is required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await workflowStepsApi.createSampleSet({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        sample_ids: draft.sampleIds,
      });
      await onCreated();
      setOpen(false);
      setDraft(createDraft());
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : String(createError),
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    state: {
      createSampleSetOpen: open,
      createSampleSetDraft: draft,
      createSampleSetLoading: loading,
      sampleFilters: createSampleFilterConfig({
        filters,
        sampleSets,
        onChange: setSampleFilterField,
      }),
      visibleSamples,
    },
    actions: {
      openCreateSampleSet,
      closeCreateSampleSet,
      updateCreateSampleSetField,
      toggleSampleSetSample,
      toggleAllVisibleSampleSetSamples,
      submitCreateSampleSet,
      applySampleFilters,
      clearSampleFilters,
    },
    samples,
  };
}
