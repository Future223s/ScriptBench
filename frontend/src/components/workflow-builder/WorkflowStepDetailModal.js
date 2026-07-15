"use client";

import { Modal } from "../common/Modal.js";
import { findNode, findOutputSpec, findTemplate } from "./workflowBuilderUtils.js";

export function WorkflowStepDetailModal({ state, actions }) {
  const selectedNode = findNode(state.nodes, state.detailNodeId);
  if (!state.detailOpen || !selectedNode) {
    return null;
  }

  const selectedTemplate = findTemplate(state.payloadTemplates, selectedNode.payload_template_id);
  const selectedOutputSpec = findOutputSpec(state.outputSpecifications, selectedNode.output_spec_id);

  return (
    <Modal
      open={state.detailOpen}
      backdropClassName="workflow-builder-modal-backdrop workflow-builder-detail-backdrop"
      panelClassName="workflow-builder-modal-panel workflow-builder-detail-modal"
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>{selectedNode.label}</h2>
          <span>Details</span>
        </div>
        <button className="btn-ghost" type="button" onClick={actions.closeNodeDetail}>
          Close
        </button>
      </div>
      <div className="modal-body workflow-builder-modal-body">
        <div className="detail-card">
          <h3>Step details</h3>
          <div className="metadata-grid">
            <div className="metadata-row">
              <span>Title</span>
              <strong>{selectedNode.label}</strong>
            </div>
            <div className="metadata-row">
              <span>Canvas position</span>
              <strong>
                Row {selectedNode.row}, Col {selectedNode.col}
              </strong>
            </div>
            <div className="metadata-row">
              <span>Payload template</span>
              <strong>{selectedTemplate?.name || "Template"}</strong>
            </div>
            <div className="metadata-row">
              <span>Output specification</span>
              <strong>{selectedOutputSpec?.name || "Output"}</strong>
            </div>
          </div>
        </div>
        <div className="detail-card">
          <h3>Description</h3>
          <p className="workflow-builder-detail-copy">{selectedNode.description || "No description provided."}</p>
        </div>
      </div>
    </Modal>
  );
}
