"use client";

import { TopBar } from "./TopBar.js";
import { useTopBar } from "../../hooks/layout/useTopBar.js";

export function AppShellContent({ children }) {
  const topBar = useTopBar();

  return (
    <>
      <TopBar
        loading={topBar.loading}
        sampleCount={topBar.sampleCount}
        sampleSetCount={topBar.sampleSetCount}
        prototypeNav={topBar.prototypeNav}
        onCreateWorkflow={topBar.openWorkflowWizard}
        onNavigatePrototype={topBar.navigatePrototype}
      />
      {children}
    </>
  );
}
