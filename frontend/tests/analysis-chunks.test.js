import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyAnalysis,
  mergeAnalysisChunk,
} from "../src/hooks/analysis/analysisShared.js";

test("analysis chunks append new records and replace duplicate IDs", () => {
  const first = mergeAnalysisChunk(emptyAnalysis(), {
    transcriptions: [{ id: 1, text: "draft" }],
    disagreements: [{ id: "1:2:1", source_text: "a" }],
  });
  const complete = mergeAnalysisChunk(first, {
    transcriptions: [
      { id: 1, text: "updated" },
      { id: 2, text: "review" },
    ],
    disagreements: [
      { id: "1:2:1", source_text: "updated" },
      { id: "2:3:1", source_text: "b" },
    ],
  });

  assert.deepEqual(complete.transcriptions, [
    { id: 1, text: "updated" },
    { id: 2, text: "review" },
  ]);
  assert.deepEqual(complete.disagreements, [
    { id: "1:2:1", source_text: "updated" },
    { id: "2:3:1", source_text: "b" },
  ]);
});
