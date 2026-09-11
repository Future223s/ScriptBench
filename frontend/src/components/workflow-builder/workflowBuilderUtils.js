export function getCanvasBounds(state) {
  const minRows = 3;
  const minCols = 7;

  if (!state.nodes.length) {
    return {
      minRow: 1,
      maxRow: 3,
      minCol: 1,
      maxCol: 7,
      rows: 3,
      cols: 7,
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
    minRow -= Math.floor(extraRows / 2);
    maxRow += Math.ceil(extraRows / 2);
  }

  const colSpan = maxCol - minCol + 1;
  if (colSpan < minCols) {
    const extraCols = minCols - colSpan;
    minCol -= Math.floor(extraCols / 2);
    maxCol += Math.ceil(extraCols / 2);
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
