export function getCanvasBounds(state) {
  const minRows = 5;
  const minCols = 7;

  if (!state.nodes.length) {
    return {
      minRow: 1,
      maxRow: minRows,
      minCol: 1,
      maxCol: 7,
      rows: minRows,
      cols: 7,
    };
  }

  const rows = state.nodes.map((node) => Number(node.row));
  const cols = state.nodes.map((node) => Number(node.col));
  // Coordinates persisted by the API are one-based. Keep the expanded canvas
  // one-based too, so selecting an empty leading cell cannot submit row/col 0.
  let minRow = Math.max(1, Math.min(...rows) - 1);
  let maxRow = Math.max(...rows) + 1;
  let minCol = Math.max(1, Math.min(...cols) - 1);
  let maxCol = Math.max(...cols) + 1;

  const rowSpan = maxRow - minRow + 1;
  if (rowSpan < minRows) {
    const extraRows = minRows - rowSpan;
    const rowsBefore = Math.min(minRow - 1, Math.floor(extraRows / 2));
    minRow -= rowsBefore;
    maxRow += extraRows - rowsBefore;
  }

  const colSpan = maxCol - minCol + 1;
  if (colSpan < minCols) {
    const extraCols = minCols - colSpan;
    const colsBefore = Math.min(minCol - 1, Math.floor(extraCols / 2));
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
