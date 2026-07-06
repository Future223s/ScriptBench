"use client";

export function WorkflowWizardStepper({ wizardStep }) {
  return (
    <div className="stepper">
      {["Identity", "Sample set", "Prompt spec"].map((label, index) => (
        <div key={label} className={["step", wizardStep === index ? "is-active" : ""].filter(Boolean).join(" ")}>
          {label}
        </div>
      ))}
    </div>
  );
}
