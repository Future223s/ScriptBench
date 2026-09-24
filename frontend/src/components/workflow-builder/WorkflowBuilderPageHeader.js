"use client";

import {
  Button,
  Inline,
  PageHeader,
  StackedSelect,
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
    <PageHeader
      variant="floating"
      showCopy={false}
      title="Workflow Builder"
      description="Compose and configure a reusable execution graph."
      controls={
        <StackedSelect
          label="Workflow"
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
        </StackedSelect>
      }
      actions={
        <Inline gap="compact" justify="end">
        <Button
          size="compact"
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
          onClick={onFinalize}
          disabled={finalizeDisabled}
        >
          {finalizing ? "Finalizing..." : "Finalize workflow"}
        </Button>
        </Inline>
      }
    />
  );
}
