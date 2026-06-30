export function renderAppShell({ topbar, error, status, notice, main, modals }) {
  return `
    <div class="app-shell">
      ${topbar}
      ${error ? `<div class="error-banner">${error}</div>` : ""}
      ${status ? `<div class="status-banner">${status}</div>` : ""}
      ${notice ? `<div class="success-banner">${notice}</div>` : ""}
      ${main}
      ${modals}
    </div>
  `;
}
