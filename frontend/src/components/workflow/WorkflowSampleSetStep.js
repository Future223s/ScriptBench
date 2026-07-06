"use client";

export function WorkflowSampleSetStep({ workflowDraft, sampleSets, actions }) {
  const selectedSampleSetId = Number(workflowDraft.sample_set_id) || null;
  const selectedSampleSet = sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === selectedSampleSetId) || null;

  return (
    <div className="form-grid">
      <div className="field wide">
        <label htmlFor="workflow-sample-set">Sample set</label>
        <select
          id="workflow-sample-set"
          data-draft="sample_set_id"
          value={workflowDraft.sample_set_id || ""}
          onChange={(event) => actions.setWorkflowSampleSet(event.target.value)}
          required
          disabled={!sampleSets.length}
        >
          <option value="">Choose a sample set</option>
          {sampleSets.length ? (
            sampleSets.map((sampleSet) => (
              <option key={sampleSet.sample_set_id} value={sampleSet.sample_set_id}>
                {sampleSet.sample_set_name} ({sampleSet.sample_count || 0} samples)
              </option>
            ))
          ) : (
            <option value="">No sample sets available</option>
          )}
        </select>
      </div>
      <div className="field wide">
        <label>Selected sample set</label>
        <div className="detail-card">
          <h3>{selectedSampleSet?.sample_set_name || "No sample set selected"}</h3>
          <div className="metadata-grid">
            <div className="metadata-row">
              <span>Samples</span>
              <strong>{selectedSampleSet?.sample_count || 0}</strong>
            </div>
            <div className="metadata-row">
              <span>Workflows</span>
              <strong>{selectedSampleSet?.workflow_count || 0}</strong>
            </div>
          </div>
          <div className="count-label">The workflow will use this sample set as its backbone.</div>
        </div>
      </div>
    </div>
  );
}
