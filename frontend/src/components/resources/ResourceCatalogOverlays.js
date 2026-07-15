"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Modal } from "../common/Modal.js";

function ResourceDetailModal({ open, record, actions }) {
  return (
    <Modal
      open={open}
      panelClassName="resource-detail-modal"
      data-modal="resource-detail"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeResourceDetail();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>{record?.title || "Resource"}</h2>
          <span>{record?.typeLabel || "Detail"}</span>
        </div>
        <button className="btn-ghost" type="button" onClick={actions.closeResourceDetail}>
          Close
        </button>
      </div>
      <div className="modal-body">
        {record ? (
          <div className="resource-detail-grid">
            <div className="ground-truth-box">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                {(record.metadata || []).map(([label, value]) => (
                  <div className="metadata-row" key={label}>
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="ground-truth-box">
              {(record.sections || []).map((section) => (
                <div key={section.title} className="resource-detail-section">
                  <h3>{section.title}</h3>
                  <pre>{section.content || ""}</pre>
                </div>
              ))}
              <div className="resource-detail-section">
                <h3>Raw record</h3>
                <pre>{JSON.stringify(record.raw || {}, null, 2)}</pre>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>No resource selected.</EmptyState>
        )}
      </div>
    </Modal>
  );
}

function ArtifactGroupCreateModal({ open, state, actions }) {
  const draft = state.createArtifactGroupDraft;
  const step = state.createArtifactGroupStep;
  const stepTitle =
    step === 1
      ? "Group Details"
      : step === 2
        ? "Group Membership"
        : step === 3
          ? "Sample Mapping"
          : "Review and Create";

  return (
    <Modal
      open={open}
      panelClassName="artifact-group-create-modal"
      data-modal="artifact-group-create"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeCreateArtifactGroup();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Artifact Group</h2>
          <span>Step {step} of 4: {stepTitle}</span>
        </div>
        <button className="btn-ghost" type="button" onClick={actions.closeCreateArtifactGroup}>
          Close
        </button>
      </div>
      <div className="modal-body artifact-group-create-body">
        {step === 1 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="artifact-group-name">Group name</label>
              <input
                id="artifact-group-name"
                value={draft.groupName}
                onChange={(event) => actions.setCreateArtifactGroupField("groupName", event.target.value)}
                placeholder="Line Artifacts"
              />
            </div>
            <div className="field wide">
              <label htmlFor="artifact-group-description">Description</label>
              <textarea
                id="artifact-group-description"
                rows="4"
                value={draft.description}
                onChange={(event) => actions.setCreateArtifactGroupField("description", event.target.value)}
                placeholder="Artifacts representing extracted text lines"
              />
            </div>
            <div className="field wide">
              <label>Mapping type</label>
              <div className="artifact-group-radio-grid">
                <label className="artifact-group-radio-option">
                  <input
                    type="radio"
                    checked={draft.mappingType === "one-to-one"}
                    onChange={() => actions.setCreateArtifactGroupField("mappingType", "one-to-one")}
                  />
                  <span>One-to-one</span>
                </label>
                <label className="artifact-group-radio-option">
                  <input
                    type="radio"
                    checked={draft.mappingType === "one-to-many"}
                    onChange={() => actions.setCreateArtifactGroupField("mappingType", "one-to-many")}
                  />
                  <span>One-to-many</span>
                </label>
              </div>
            </div>
            <div className="field wide">
              <label htmlFor="artifact-group-ordering">Ordering</label>
              <select
                id="artifact-group-ordering"
                value={draft.ordering}
                onChange={(event) => actions.setCreateArtifactGroupField("ordering", event.target.value)}
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="artifact-id">Artifact ID</option>
              </select>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="membership-artifact-field">Artifact field</label>
              <select
                id="membership-artifact-field"
                value={draft.membershipArtifactField}
                onChange={(event) => actions.setCreateArtifactGroupField("membershipArtifactField", event.target.value)}
              >
                <option value="artifact_name">Artifact name</option>
                <option value="originating_sample_id">Originating sample ID</option>
                <option value="artifact_group_name">Artifact group name</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="membership-operator">Operator</label>
              <select
                id="membership-operator"
                value={draft.membershipOperator}
                onChange={(event) => actions.setCreateArtifactGroupField("membershipOperator", event.target.value)}
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="membership-pattern">Pattern</label>
              <input
                id="membership-pattern"
                value={draft.membershipPattern}
                onChange={(event) => actions.setCreateArtifactGroupField("membershipPattern", event.target.value)}
                placeholder="_line_"
              />
            </div>
            <div className="field wide">
              <label className="artifact-group-checkbox-option">
                <input
                  type="checkbox"
                  checked={draft.membershipCaseSensitive}
                  onChange={(event) => actions.setCreateArtifactGroupField("membershipCaseSensitive", event.target.checked)}
                />
                <span>Case sensitive</span>
              </label>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="sample-mapping-artifact-field">Artifact field</label>
              <select
                id="sample-mapping-artifact-field"
                value={draft.sampleMappingArtifactField}
                onChange={(event) => actions.setCreateArtifactGroupField("sampleMappingArtifactField", event.target.value)}
              >
                <option value="artifact_name">Artifact name</option>
                <option value="originating_sample_id">Originating sample ID</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sample-mapping-sample-field">Sample field</label>
              <select
                id="sample-mapping-sample-field"
                value={draft.sampleMappingSampleField}
                onChange={(event) => actions.setCreateArtifactGroupField("sampleMappingSampleField", event.target.value)}
              >
                <option value="sample_name">Sample name</option>
                <option value="sample_id">Sample ID</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sample-mapping-operator">Operator</label>
              <select
                id="sample-mapping-operator"
                value={draft.sampleMappingOperator}
                onChange={(event) => actions.setCreateArtifactGroupField("sampleMappingOperator", event.target.value)}
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
              </select>
            </div>
            <div className="field wide">
              <label className="artifact-group-checkbox-option">
                <input
                  type="checkbox"
                  checked={draft.sampleMappingCaseSensitive}
                  onChange={(event) => actions.setCreateArtifactGroupField("sampleMappingCaseSensitive", event.target.checked)}
                />
                <span>Case sensitive</span>
              </label>
            </div>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="artifact-group-review-grid">
            <div className="ground-truth-box">
              <h3>Group</h3>
              <div className="metadata-grid">
                <div className="metadata-row"><span>Name</span><strong>{draft.groupName || "Not set"}</strong></div>
                <div className="metadata-row"><span>Mapping type</span><strong>{draft.mappingType}</strong></div>
                <div className="metadata-row"><span>Ordering</span><strong>{draft.ordering}</strong></div>
              </div>
            </div>
            <div className="ground-truth-box">
              <h3>Membership rule</h3>
              <pre>{`${draft.membershipArtifactField} ${draft.membershipOperator} "${draft.membershipPattern || ""}"`}</pre>
              <h3>Sample mapping</h3>
              <pre>{`${draft.sampleMappingArtifactField} ${draft.sampleMappingOperator} ${draft.sampleMappingSampleField}`}</pre>
              <h3>Description</h3>
              <pre>{draft.description || "No description provided."}</pre>
            </div>
          </div>
        ) : null}
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" type="button" onClick={actions.closeCreateArtifactGroup} disabled={state.createArtifactGroupLoading}>
          Cancel
        </button>
        <div className="inline-actions">
          {step > 1 ? (
            <button className="btn-ghost" type="button" onClick={actions.previousCreateArtifactGroupStep} disabled={state.createArtifactGroupLoading}>
              Back
            </button>
          ) : null}
          {step < 4 ? (
            <button className="btn-primary" type="button" onClick={actions.nextCreateArtifactGroupStep} disabled={state.createArtifactGroupLoading}>
              Next
            </button>
          ) : (
            <button className="btn-primary" type="button" onClick={actions.submitCreateArtifactGroup} disabled={state.createArtifactGroupLoading}>
              {state.createArtifactGroupLoading ? "Creating..." : "Create Artifact Group"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ResourceCatalogOverlays({ state, actions }) {
  return (
    <>
      <ResourceDetailModal
        open={state.detailOpen}
        record={state.selectedResource}
        actions={actions}
      />
      <ArtifactGroupCreateModal
        open={state.createArtifactGroupOpen}
        state={state}
        actions={actions}
      />
    </>
  );
}
