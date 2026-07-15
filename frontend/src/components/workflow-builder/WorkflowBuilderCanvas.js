"use client";

import { Panel } from "../common/Panel.js";
import {
  getCanvasBounds,
  getCellKey,
  getPlacementTargets,
  findNode,
} from "./workflowBuilderUtils.js";

export function WorkflowBuilderCanvas({ state, actions }) {
  const bounds = getCanvasBounds(state);
  const placementTargets = getPlacementTargets(state, bounds);
  const occupiedCells = new Map(state.nodes.map((node) => [getCellKey(Number(node.row), Number(node.col)), node]));

  function toPoint(row, col) {
    return {
      x: (((col - bounds.minCol) + 0.5) / bounds.cols) * 100,
      y: (((row - bounds.minRow) + 0.5) / bounds.rows) * 100,
    };
  }

  return (
    <Panel className="workflow-builder-panel workflow-builder-canvas-panel">
      <div className="workflow-builder-canvas-header">
        <div className="panel-title">
          <h2>Canvas</h2>
        </div>
        <div className="workflow-builder-canvas-actions">
          <button className="btn-primary btn-tight" type="button" onClick={actions.enterAddWorkflowStepMode}>
            + Add Step
          </button>
          <button className="btn-secondary btn-tight" type="button" onClick={actions.enterAddDependencyMode}>
            Add Dependency
          </button>
          <button className="btn-secondary btn-tight" type="button" onClick={actions.enterDeleteWorkflowStepMode}>
            Delete Step
          </button>
          <button className="btn-secondary btn-tight" type="button" onClick={actions.enterDeleteDependencyMode}>
            Delete Dependency
          </button>
          <button className="btn-ghost btn-tight" type="button" onClick={actions.cancelCanvasAction}>
            Cancel
          </button>
        </div>
      </div>
      <div className="workflow-builder-panel-body">
        <div
          className="workflow-builder-canvas"
          style={{
            gridTemplateColumns: `repeat(${bounds.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${bounds.rows}, minmax(0, 1fr))`,
            aspectRatio: `${bounds.cols} / ${bounds.rows}`,
          }}
        >
          <svg className="workflow-builder-canvas-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="workflow-builder-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
              </marker>
            </defs>
            {state.edges.map((edge) => {
              const fromNode = findNode(state.nodes, edge.from);
              const toNode = findNode(state.nodes, edge.to);
              if (!fromNode || !toNode) return null;

              const sourcePoint = toPoint(Number(fromNode.row), Number(fromNode.col));
              const targetPoint = toPoint(Number(toNode.row), Number(toNode.col));

              return (
                <g
                  key={edge.id}
                  className={["workflow-builder-edge", Number(state.selectedEdgeId) === Number(edge.id) ? "is-selected" : ""].filter(Boolean).join(" ")}
                >
                  <line
                    x1={sourcePoint.x}
                    y1={sourcePoint.y}
                    x2={targetPoint.x}
                    y2={targetPoint.y}
                    markerEnd="url(#workflow-builder-arrow)"
                    onClick={() => actions.selectWorkflowEdge(edge.id)}
                  />
                </g>
              );
            })}
          </svg>
          {Array.from({ length: bounds.rows }, (_, rowIndex) =>
            Array.from({ length: bounds.cols }, (_, colIndex) => {
              const row = bounds.minRow + rowIndex;
              const col = bounds.minCol + colIndex;
              const cellKey = getCellKey(row, col);
              const node = occupiedCells.get(cellKey) || null;
              const isSelectedNode = Boolean(node && Number(state.selectedNodeId) === Number(node.id));
              const isPlacementTarget = placementTargets.has(cellKey);

              return (
                <div key={cellKey} className="workflow-builder-canvas-cell">
                  {node ? (
                    <button
                      type="button"
                      className={[
                        "workflow-builder-node",
                        isSelectedNode ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => actions.selectNode(node.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        actions.openNodeDetail(node.id);
                      }}
                    >
                      <strong>{node.label}</strong>
                    </button>
                  ) : isPlacementTarget ? (
                    <button
                      type="button"
                      className="workflow-builder-placement-square"
                      aria-label="Add workflow step here"
                      onClick={() => actions.selectPlacementTarget(row, col)}
                    >
                      <span>+</span>
                    </button>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </Panel>
  );
}
