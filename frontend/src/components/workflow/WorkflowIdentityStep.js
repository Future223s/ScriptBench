"use client";

import { Field, Stack, Textarea, TextInput } from "../../ui/primitives/index.js";

export function WorkflowIdentityStep({ workflowDraft, actions }) {
  return (
    <Stack gap="compact">
      <Field label="Workflow name">
        <TextInput
          value={workflowDraft.name}
          onChange={(event) =>
            actions.setWorkflowDraftField("name", event.target.value)
          }
          required
        />
      </Field>
      <Field label="Description" optional>
        <Textarea
          value={workflowDraft.description}
          onChange={(event) =>
            actions.setWorkflowDraftField(
              "description",
              event.target.value,
            )
          }
          rows={4}
        />
      </Field>
    </Stack>
  );
}
