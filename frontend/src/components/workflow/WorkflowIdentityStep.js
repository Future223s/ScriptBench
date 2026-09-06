"use client";

import {
  Field,
  Grid,
  Select,
  Stack,
  TextInput,
} from "../../ui/primitives/index.js";
import { modelFamilies } from "../../utils/workflow.js";

export function WorkflowIdentityStep({ workflowDraft, actions }) {
  return (
    <Stack gap="compact">
      <Field label="Workflow name">
        <TextInput
          value={workflowDraft.workflow_name}
          onChange={(event) =>
            actions.setWorkflowDraftField("workflow_name", event.target.value)
          }
          required
        />
      </Field>
      <Grid columns={2}>
        <Field label="Workflow stage">
          <TextInput
            value={workflowDraft.workflow_stage}
            onChange={(event) =>
              actions.setWorkflowDraftField(
                "workflow_stage",
                event.target.value,
              )
            }
            required
          />
        </Field>
        <Field label="Model family">
          <Select
            value={workflowDraft.model_family}
            onChange={(event) =>
              actions.setWorkflowDraftField("model_family", event.target.value)
            }
          >
            {modelFamilies.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model">
          <TextInput
            value={workflowDraft.model}
            onChange={(event) =>
              actions.setWorkflowDraftField("model", event.target.value)
            }
          />
        </Field>
        <Field label="Groups">
          <TextInput
            value={workflowDraft.groups}
            onChange={(event) =>
              actions.setWorkflowDraftField("groups", event.target.value)
            }
            placeholder="Comma separated"
          />
        </Field>
      </Grid>
    </Stack>
  );
}
