"use client";

export function WorkspacePicker({
  workflows,
  selectedWorkflowId,
  loading,
  actions,
}) {
  const options = workflows.length ? (
    workflows.map((workflow) => (
      <option key={workflow.workflow_id} value={workflow.workflow_id}>
        {workflow.workflow_name}
      </option>
    ))
  ) : (
    <option value="">No workflows available</option>
  );

  return (
    <section className="workspace-shell">
      <section className="panel workspace-picker-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h2>Workflow workspace</h2>
            <span>{loading ? "Loading workflows..." : "Pick a workflow or create one to continue"}</span>
          </div>
          <button className="btn-primary" type="button" onClick={actions?.openDashboard}>
            Create workflow
          </button>
        </div>

        <div className="workspace-picker-body">
          <div className="field wide workspace-picker-select">
            <label htmlFor="workspace-workflow-select">Existing workflows</label>
            <select
              id="workspace-workflow-select"
              value={selectedWorkflowId ?? ""}
              onChange={(event) => actions?.setWorkspacePickerWorkflowId?.(Number(event.target.value) || null)}
            >
              <option value="">Choose a workflow</option>
              {options}
            </select>
          </div>
          <div className="workspace-picker-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={actions?.openSelectedWorkflow}
              disabled={!selectedWorkflowId}
            >
              Open workflow
            </button>
            <p className="count-label">
              If you already have a workflow, select it here. Otherwise create a new one from the top bar or here.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
