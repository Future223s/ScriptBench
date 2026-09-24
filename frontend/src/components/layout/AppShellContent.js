"use client";

import { TopBar } from "./TopBar.js";
import { useTopBar } from "../../hooks/layout/useTopBar.js";

export function AppShellContent({ children }) {
  const topBar = useTopBar();

  return (
    <div className="app-shell-frame">
      <TopBar
        prototypeNav={topBar.prototypeNav}
        onNavigatePrototype={topBar.navigatePrototype}
      />
      <div className="app-shell-content">{children}</div>
    </div>
  );
}
