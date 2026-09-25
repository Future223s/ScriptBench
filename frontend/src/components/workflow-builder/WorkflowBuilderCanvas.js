"use client";

import { useState } from "react";
import {
  Button,
  CanvasEdge,
  CanvasNode,
  CanvasSurface,
  Inline,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { getCanvasBounds, findNode } from "./workflowBuilderUtils.js";

export function WorkflowBuilderCanvas({ state, actions }) {
  const bounds = getCanvasBounds(state);
  const [hoveredPlacement, setHoveredPlacement] = useState(null);

  function toPoint(row, col) {
    return {
      x: ((col - bounds.minCol + 0.5) / bounds.cols) * 100,
      y: ((row - bounds.minRow + 0.5) / bounds.rows) * 100,
    };
  }

  const modeHint = {
    "add-step": "Choose an empty canvas position.",
    "add-dependency": state.dependencySourceNodeId
      ? "Choose the destination step."
      : "Choose the source step.",
    "delete-step": "Choose a step to remove.",
    "delete-dependency": "Choose a dependency to remove.",
  }[state.mode];

  function getPlacementFromPointer(event) {
    if (state.mode !== "add-step") return null;
    const viewport = event.currentTarget.querySelector("[data-canvas-viewport]");
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    const row = bounds.minRow + Math.min(bounds.rows - 1, Math.floor(y * bounds.rows));
    const col = bounds.minCol + Math.min(bounds.cols - 1, Math.floor(x * bounds.cols));
    return state.nodes.some((node) => Number(node.row) === row && Number(node.col) === col)
      ? null
      : { row, col };
  }

  return (
    <section className="workflow-builder-canvas-shell">
      <CanvasSurface
        label="Workflow canvas"
        size="workspace"
        fill
        onPointerMove={(event) => setHoveredPlacement(getPlacementFromPointer(event))}
        onPointerLeave={() => setHoveredPlacement(null)}
      >
        {state.edges.map((edge) => {
          const fromNode = findNode(state.nodes, edge.from);
          const toNode = findNode(state.nodes, edge.to);
          if (!fromNode || !toNode) return null;
          const from = toPoint(Number(fromNode.row), Number(fromNode.col));
          const to = toPoint(Number(toNode.row), Number(toNode.col));
          return (
            <CanvasEdge
              key={edge.id}
              fromX={from.x}
              fromY={from.y}
              toX={to.x}
              toY={to.y}
              selected={Number(state.selectedEdgeId) === Number(edge.id)}
              onClick={() => actions.selectWorkflowEdge(edge.id)}
            />
          );
        })}
        {state.nodes.map((node) => {
          const point = toPoint(Number(node.row), Number(node.col));
          return (
            <CanvasNode
              key={node.id}
              x={point.x}
              y={point.y}
              title={node.label}
              detail={node.executor_config?.provider || node.executor_config?.executor || node.step_executor_id || "Executor not specified"}
              selected={Number(state.selectedNodeId) === Number(node.id)}
              onClick={() => actions.selectNode(node.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                actions.openNodeDetail(node.id);
              }}
            />
          );
        })}
        {hoveredPlacement ? (
          <CanvasNode
            x={toPoint(hoveredPlacement.row, hoveredPlacement.col).x}
            y={toPoint(hoveredPlacement.row, hoveredPlacement.col).y}
            title="Add step"
            detail="Click to place"
            variant="preview"
            ariaLabel="Add workflow step here"
            onClick={() => actions.selectPlacementTarget(hoveredPlacement.row, hoveredPlacement.col)}
          />
        ) : null}
      </CanvasSurface>
      {modeHint ? (
        <div className="workflow-builder-canvas-mode-hint" role="status">
          <StatusBadge size="compact">{modeHint}</StatusBadge>
        </div>
      ) : null}
      <div className="workflow-builder-canvas-tools">
        <Inline gap="compact" justify="end">
          <Button
            size="compact"
            onClick={actions.enterAddWorkflowStepMode}
            aria-pressed={state.mode === "add-step"}
          >
            Add step
          </Button>
          <Button
            size="compact"
            onClick={actions.enterAddDependencyMode}
            aria-pressed={state.mode === "add-dependency"}
          >
            Add dependency
          </Button>
          <Button
            size="compact"
            onClick={actions.enterDeleteWorkflowStepMode}
            aria-pressed={state.mode === "delete-step"}
          >
            Delete step
          </Button>
          <Button
            size="compact"
            onClick={actions.enterDeleteDependencyMode}
            aria-pressed={state.mode === "delete-dependency"}
          >
            Delete dependency
          </Button>
          <Button size="compact" onClick={actions.cancelCanvasAction}>
            Cancel
          </Button>
        </Inline>
      </div>
    </section>
  );
}
