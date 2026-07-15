"use client";

import { useState } from "react";

import {
  DEFAULT_FILTERS,
  cloneFilters,
  currentDefaultAction,
  normalizeManagementType,
  visibleRecordsForType,
} from "./fileManagementShared.js";

export function useFileBrowser(catalogState) {
  const [managementType, setManagementTypeState] = useState("sample");
  const [managementAction, setManagementAction] = useState(currentDefaultAction("sample"));
  const [filters, setFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));
  const [appliedFilters, setAppliedFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));

  const selectorState = {
    ...catalogState,
    appliedFilters,
  };
  const visibleRecords = visibleRecordsForType(selectorState, managementType);

  function setManagementType(type) {
    const normalizedType = normalizeManagementType(type);
    setManagementTypeState(normalizedType);
    setManagementAction(currentDefaultAction(normalizedType));
  }

  function setFilterField(type, field, value) {
    setFilters((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: value,
      },
    }));
  }

  function clearFilters(type = managementType) {
    const normalizedType = normalizeManagementType(type);
    const defaults = cloneFilters(DEFAULT_FILTERS)[normalizedType];
    setFilters((current) => ({
      ...current,
      [normalizedType]: { ...defaults },
    }));
    setAppliedFilters((current) => ({
      ...current,
      [normalizedType]: { ...defaults },
    }));
  }

  function applyFilters() {
    setAppliedFilters(cloneFilters(filters));
  }

  return {
    state: {
      managementType,
      managementAction,
      filters,
      appliedFilters,
      visibleRecords,
    },
    actions: {
      setManagementType,
      setFilterField,
      clearFilters,
      applyFilters,
    },
  };
}
