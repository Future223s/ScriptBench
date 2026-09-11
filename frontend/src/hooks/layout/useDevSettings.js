"use client";

import { useEffect, useState } from "react";
import { devSettingsApi } from "../../api/endpoints/devSettings.ts";

export function useDevSettings() {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    devSettingsApi.get().then((value) => {
      if (mounted) setSettings(value);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  async function refresh() {
    setBusy(true);
    setError("");
    try { setSettings(await devSettingsApi.get()); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function update(field, value) {
    setBusy(true);
    setError("");
    try {
      setSettings(await devSettingsApi.update({
        stub_mode: settings.stub_mode,
        stub_fail: settings.stub_fail,
        [field]: value,
      }));
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  return { settings, busy, error, refresh, update };
}
