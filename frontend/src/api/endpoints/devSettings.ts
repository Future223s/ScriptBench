import { apiFetch } from "../client";

export interface DevSettings {
  dev: boolean;
  stub_mode: boolean;
  stub_fail: boolean;
}

export const devSettingsApi = {
  get: () => apiFetch<DevSettings>("/api/v2/dev-settings"),
  update: (settings: Pick<DevSettings, "stub_mode" | "stub_fail">) =>
    apiFetch<DevSettings>("/api/v2/dev-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    }),
};
