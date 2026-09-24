"use client";

import {
  Button,
  Inline,
  PageTitle,
  Select,
} from "../../ui/primitives/index.js";

export function WorkflowBuilderPageHeader({
  saving = false,
  finalizing = false,
  disabled = false,
  finalizeDisabled = false,
  workflows = [],
  selectedWorkflowId = "",
  onSelectWorkflow,
  onNewWorkflow,
  onSave,
  onFinalize,
}) {
  return (
    <header className="workflow-builder-header">
      <Inline gap="compact">
        <PageTitle>Workflow Builder</PageTitle>
        <Select
          inline
          value={selectedWorkflowId || ""}
          onChange={(event) => onSelectWorkflow?.(event.target.value)}
          aria-label="Select workflow"
        >
          <option value="">Select a workflow</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </Select>
      </Inline>
      <Inline gap="compact" justify="end">
        <Button
          size="compact"
          variant="primary"
          onClick={onNewWorkflow}
          disabled={saving || finalizing}
        >
          New workflow
        </Button>
        <Button
          size="compact"
          variant="primary"
          onClick={onSave}
          disabled={disabled}
        >
          {saving ? "Saving..." : "Save workflow"}
        </Button>
        <Button
          size="compact"
          variant="primary"
          onClick={onFinalize}
          disabled={finalizeDisabled}
        >
          {finalizing ? "Finalizing..." : "Finalize workflow"}
        </Button>
      </Inline>
    </header>
  );
}
