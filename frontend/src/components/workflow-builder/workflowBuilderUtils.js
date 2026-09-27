export const CANVAS_MIN_ROWS = 15;
export const CANVAS_MIN_COLS = 21;
// Match the rendered 150px card footprint on the canonical 15 × 21 grid.
// These values are minimum center-to-center separations, not extra padding.
export const CANVAS_NODE_ROW_SPAN = 2;
export const CANVAS_NODE_COL_SPAN = 4;

export function canvasNodesOverlap(left, right) {
  return (
    Math.abs(Number(left.row) - Number(right.row)) < CANVAS_NODE_ROW_SPAN &&
    Math.abs(Number(left.col) - Number(right.col)) < CANVAS_NODE_COL_SPAN
  );
}

export function isCanvasPlacementAvailable(nodes, row, col) {
  return !(nodes || []).some((node) =>
    canvasNodesOverlap(node, { row, col }),
  );
}

export function getCanvasBounds(state) {
  const minRows = CANVAS_MIN_ROWS;
  const minCols = CANVAS_MIN_COLS;

  if (!state.nodes.length) {
    return {
      minRow: -7,
      maxRow: 7,
      minCol: -10,
      maxCol: 10,
      rows: minRows,
      cols: minCols,
    };
  }

  const rows = state.nodes.map((node) => Number(node.row));
  const cols = state.nodes.map((node) => Number(node.col));
  let minRow = Math.min(...rows) - 1;
  let maxRow = Math.max(...rows) + 1;
  let minCol = Math.min(...cols) - 1;
  let maxCol = Math.max(...cols) + 1;

  const rowSpan = maxRow - minRow + 1;
  if (rowSpan < minRows) {
    const extraRows = minRows - rowSpan;
    const rowsBefore = Math.floor(extraRows / 2);
    minRow -= rowsBefore;
    maxRow += extraRows - rowsBefore;
  }

  const colSpan = maxCol - minCol + 1;
  if (colSpan < minCols) {
    const extraCols = minCols - colSpan;
    const colsBefore = Math.floor(extraCols / 2);
    minCol -= colsBefore;
    maxCol += extraCols - colsBefore;
  }

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    rows: maxRow - minRow + 1,
    cols: maxCol - minCol + 1,
  };
}

export function getCellKey(row, col) {
  return `${row}:${col}`;
}

export function findNode(nodes, nodeId) {
  return nodes.find((node) => Number(node.id) === Number(nodeId)) || null;
}

export function formatFamilyLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatStepOptionLabel(step) {
  if (!step) return "Choose a step";
  const family = formatFamilyLabel(step.step_executor_id);
  const version = Number(step.version) || 1;
  return `${step.name} — ${family}, v${version}`;
}

export function formatStepSummary(step) {
  if (!step) return "";
  return `${formatFamilyLabel(step.step_executor_id)} · ${step.executor_config?.model || "Unknown"} · Version ${Number(step.version) || 1}`;
}
