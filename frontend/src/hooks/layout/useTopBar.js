"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { dashboardApi } from "../../api/endpoints/dashboard.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { useWorkflowCreationHost } from "../../components/workflow/WorkflowCreationHost.js";

function getPrototypeNav(pathname) {
  if (pathname === "/file-management") return "file-management";
  if (pathname === "/workspace") return "workflow-workspace";
  return "dashboard";
}

export function useTopBar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const workflowCreation = useWorkflowCreationHost();
  const [state, setState] = useState({
    loading: true,
    sampleCount: 0,
    sampleSetCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTopBarCounts() {
      try {
        const response = await dashboardApi.getSampleSets();
        if (cancelled) return;

        const sampleSets = response.sample_sets || [];
        const sampleCount = sampleSets.reduce((total, sampleSet) => total + Number(sampleSet.sample_count || 0), 0);
        setState({
          loading: false,
          sampleCount,
          sampleSetCount: Number(response.sample_set_count ?? sampleSets.length ?? 0),
        });
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            sampleCount: 0,
            sampleSetCount: 0,
          });
        }
      }
    }

    void loadTopBarCounts();

    function handleDataChanged() {
      void loadTopBarCounts();
    }

    window.addEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [pathname]);

  function openWorkflowWizard() {
    workflowCreation?.actions.openWorkflowWizard();
  }

  function navigatePrototype(navKey) {
    if (navKey === "file-management") {
      router.push("/file-management");
      return;
    }

    if (navKey === "workflow-workspace") {
      router.push("/workspace");
      return;
    }

    router.push("/dashboard");
  }

  return {
    loading: state.loading,
    sampleCount: state.sampleCount,
    sampleSetCount: state.sampleSetCount,
    prototypeNav: getPrototypeNav(pathname),
    openWorkflowWizard,
    navigatePrototype,
  };
}
