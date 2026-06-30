import assert from "node:assert/strict";
import test from "node:test";

import { renderSampleDetailModal } from "../src/components/Modals.js";

test("sample detail modal shows sample_group and grouping values", () => {
  const html = renderSampleDetailModal({
    open: true,
    sample: {
      sample_id: "La115_1r_EMMO_line_001",
      sample_group: "La115_1v_EMMO",
      sample_mime_type: "image/png",
      ground_truth_text: "line text",
    },
    groupings: [
      {
        name: "EMMO Sample",
        assignments: {
          La115_1r_EMMO_line_001: "La115_1v_EMMO",
        },
      },
    ],
  });

  assert.match(html, /Grouping values/);
  assert.match(html, /sample_group: La115_1v_EMMO/);
  assert.match(html, /EMMO Sample: La115_1v_EMMO/);
});
