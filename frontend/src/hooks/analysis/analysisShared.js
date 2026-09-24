export const emptyAnalysis = () => ({
  transcriptions: [],
  disagreements: [],
});

function mergeItems(currentItems, incomingItems) {
  const byId = new Map(currentItems.map((item) => [String(item.id), item]));
  for (const item of incomingItems) byId.set(String(item.id), item);
  return [...byId.values()];
}

export function mergeAnalysisChunk(current, chunk) {
  return {
    transcriptions: mergeItems(
      current.transcriptions,
      chunk.transcriptions || [],
    ),
    disagreements: mergeItems(
      current.disagreements,
      chunk.disagreements || [],
    ),
  };
}
