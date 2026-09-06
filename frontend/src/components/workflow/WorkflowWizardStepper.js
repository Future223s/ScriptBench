"use client";

import { StepStrip } from "../../ui/primitives/index.js";

export function WorkflowWizardStepper({ wizardStep }) {
  return (
    <StepStrip
      activeId={["identity", "samples", "prompt"][wizardStep]}
      steps={[
        { id: "identity", label: "Identity" },
        { id: "samples", label: "Sample set" },
        { id: "prompt", label: "Prompt spec" },
      ]}
    />
  );
}
