"use client";

import { TopBar } from "./TopBar.js";
import { useTopBar } from "../../hooks/layout/useTopBar.js";

export function AppShellContent({ children }) {
  const topBar = useTopBar();

  return (
    <>
      <TopBar
        prototypeNav={topBar.prototypeNav}
        onNavigatePrototype={topBar.navigatePrototype}
      />
      {children}
    </>
  );
}
