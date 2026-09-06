"use client";

import {
  Button,
  Dialog,
  Field,
  Inline,
  Select,
  Stack,
} from "../../ui/primitives/index.js";
import { formatStepOptionLabel } from "./workflowBuilderUtils.js";

export function WorkflowStepAssignmentModal({ state, actions }) {
  return (
    <Dialog
      open={state.assignmentOpen}
      title="Add workflow step"
      onClose={actions.cancelCanvasAction}
      size="small"
      footer={
        <Inline gap="compact" justify="end">
          <Button size="compact" onClick={actions.cancelCanvasAction}>
            Cancel
          </Button>
          <Button
            size="compact"
            variant="primary"
            onClick={actions.submitWorkflowStepAssignment}
          >
            Add step
          </Button>
        </Inline>
      }
    >
      <Stack gap="compact">
        <Field label="Workflow step">
          <Select
            id="workflow-step-selector"
            value={state.assignmentStepId}
            onChange={(event) => actions.selectWorkflowStep(event.target.value)}
          >
            {state.stepCatalog.map((step) => (
              <option key={step.id} value={step.id}>
                {formatStepOptionLabel(step)}
              </option>
            ))}
          </Select>
        </Field>
      </Stack>
    </Dialog>
  );
}
