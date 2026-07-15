"use client";

import { Badge } from "../common/Badge.js";

export function WorkflowBuilderPageHeader({ saving = false, disabled = false, onSave }) {
  return (
    <header className="workflow-builder-page-header">
      <div className="workflow-builder-page-header-copy">
        <div className="workflow-builder-page-title">Workflow Builder</div>
        <Badge className="workflow-builder-status-pill">Draft</Badge>
      </div>
      <button className="btn-primary btn-tight workflow-builder-save-button" type="button" onClick={onSave} disabled={disabled}>
        {saving ? "Saving..." : "Save Workflow"}
      </button>
    </header>
  );
}
