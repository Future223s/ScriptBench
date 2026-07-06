"use client";

export function WorkflowWizardFooter({ wizardStep }) {
  return (
    <div className="modal-footer">
      <button className="btn-ghost" type="button" data-action={wizardStep === 0 ? "close-modals" : "wizard-back"}>
        {wizardStep === 0 ? "Cancel" : "Back"}
      </button>
      <div className="inline-actions">
        {wizardStep < 2 ? (
          <button className="btn-primary" type="button" data-action="wizard-next">
            Next
          </button>
        ) : (
          <button className="btn-primary" type="submit">
            Create
          </button>
        )}
      </div>
    </div>
  );
}
