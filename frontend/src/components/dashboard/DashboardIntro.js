"use client";

import {
  Button,
  EmptyState,
  Panel,
  Stack,
  StepStrip,
} from "../../ui/primitives/index.js";

export function DashboardIntro({ onNavigateFileManagement }) {
  return (
    <section className="dashboard-intro">
      <Panel title="Sample sets">
        <EmptyState title="No sample sets yet">
          Add source files to create your first set.
        </EmptyState>
      </Panel>

      <Panel
        title="Create a workflow"
        actions={
          <Button variant="primary" onClick={onNavigateFileManagement}>
            Open File Management
          </Button>
        }
      >
        <Stack>
          <StepStrip
            activeId="files"
            steps={[
              { id: "files", label: "Files", description: "Add samples" },
              { id: "set", label: "Sample set", description: "Curate files" },
              {
                id: "workflow",
                label: "Workflow",
                description: "Choose a model",
              },
            ]}
          />
        </Stack>
      </Panel>
    </section>
  );
}
