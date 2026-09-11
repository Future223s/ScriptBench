"use client";

import {
  Button,
  Field,
  Inline,
  Panel,
  Select,
  Stack,
} from "../../ui/primitives/index.js";

export function WorkspacePicker({
  workflows,
  selectedWorkflowId,
  loading,
  actions,
}) {
  return (
    <Panel
      title="Workflow workspace"
      actions={
        <Button variant="primary" onClick={actions?.openDashboard}>
          Create workflow
        </Button>
      }
    >
      <Stack gap="compact">
        <Field label="Existing workflow">
          <Select
            value={selectedWorkflowId ?? ""}
            onChange={(event) =>
              actions?.setWorkspacePickerWorkflowId?.(
                Number(event.target.value) || null,
              )
            }
            disabled={loading}
          >
            <option value="">Choose a workflow</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </Select>
        </Field>
        <Inline gap="compact">
          <Button
            variant="primary"
            onClick={actions?.openSelectedWorkflow}
            disabled={loading || !selectedWorkflowId}
          >
            Open workflow
          </Button>
        </Inline>
      </Stack>
    </Panel>
  );
}
