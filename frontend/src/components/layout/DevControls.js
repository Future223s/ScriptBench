"use client";

import { useEffect, useRef } from "react";
import { useDevSettings } from "../../hooks/layout/useDevSettings.js";

export function DevControls() {
  const { settings, busy, error, refresh, update } = useDevSettings();
  const detailsRef = useRef(null);
  useEffect(() => {
    function closeOnEscape(event) {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    }
    function closeOutside(event) {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target)) details.open = false;
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);
  if (!settings?.dev) return null;
  return (
    <details className="dev-controls" ref={detailsRef}
      onToggle={(event) => { if (event.currentTarget.open) void refresh(); }}>
      <summary aria-label="Development settings" title="Development settings">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="3" fill="var(--surface-solid)" />
          <circle cx="15" cy="17" r="3" fill="var(--surface-solid)" />
        </svg>
      </summary>
      <div className="dev-controls-panel" role="group" aria-label="Development controls" aria-busy={busy}>
        <strong>Development settings</strong>
        <label><input type="checkbox" checked={settings.stub_mode} disabled={busy}
          onChange={(event) => void update("stub_mode", event.target.checked)} />Use stub executor</label>
        <label><input type="checkbox" checked={settings.stub_fail} disabled={busy || !settings.stub_mode}
          onChange={(event) => void update("stub_fail", event.target.checked)} />Force stub failure</label>
        <p>{settings.stub_mode ? "New executions use the stub." : "New executions use real providers."}</p>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </details>
  );
}
