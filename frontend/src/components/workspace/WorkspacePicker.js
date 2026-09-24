"use client";

import {
  Button,
  Field,
  Inline,
  PageHeader,
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
    <Stack>
      <PageHeader
        title="Workspace"
        description="Select a workflow to monitor and control its execution."
        actions={
        <Button variant="primary" onClick={actions?.openDashboard}>
          Create workflow
        </Button>
      }
      />
      <Panel title="Open workflow">
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
    </Stack>
  );
}
