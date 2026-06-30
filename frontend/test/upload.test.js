import assert from "node:assert/strict";
import test from "node:test";

import {
  collectGroundTruthFolderFiles,
  collectImageFolderFiles,
  normalizeFolderSampleId,
  normalizeGroundTruthFolderSampleId,
} from "../src/utils/upload.js";

function mockFile({ name, type = "", webkitRelativePath = name, content = "" }) {
  return {
    name,
    type,
    webkitRelativePath,
    async text() {
      return content;
    },
  };
}

test("normalizeFolderSampleId keeps nested uploads unique", () => {
  assert.equal(normalizeFolderSampleId("images/set-a/page-1.png"), "set-a__page-1");
  assert.equal(normalizeFolderSampleId("images/set-a/nested/page-1.png"), "set-a__nested__page-1");
});

test("normalizeGroundTruthFolderSampleId removes the _gt suffix", () => {
  assert.equal(normalizeGroundTruthFolderSampleId("truths/set-a/page-1_gt.txt"), "set-a__page-1");
});

test("collectImageFolderFiles keeps sibling folders unique", () => {
  const imageFiles = [
    mockFile({
      name: "page-1.png",
      type: "image/png",
      webkitRelativePath: "chapter-a/page-1.png",
    }),
    mockFile({
      name: "page-1.png",
      type: "image/png",
      webkitRelativePath: "chapter-b/page-1.png",
    }),
  ];

  const collectedImages = collectImageFolderFiles(imageFiles);

  assert.deepEqual(
    collectedImages.map((entry) => entry.sampleId),
    ["chapter-a__page-1", "chapter-b__page-1"],
  );
});

test("collects images and ground truths from separate folders", async () => {
  const imageFiles = [
    mockFile({
      name: "page-1.png",
      type: "",
      webkitRelativePath: "images/set-a/page-1.png",
    }),
  ];
  const groundTruthFiles = [
    mockFile({
      name: "page-1_gt.txt",
      type: "text/plain",
      webkitRelativePath: "truths/set-a/page-1_gt.txt",
      content: "ground truth",
    }),
  ];

  const collectedImages = collectImageFolderFiles(imageFiles);
  const collectedGroundTruth = await collectGroundTruthFolderFiles(groundTruthFiles);

  assert.equal(collectedImages.length, 1);
  assert.equal(collectedImages[0].sampleId, "set-a__page-1");
  assert.equal(collectedGroundTruth.get("set-a__page-1"), "ground truth");
});

test("strips the selected crop folder root from line crop datasets", async () => {
  const imageFiles = [
    mockFile({
      name: "La115_1r_line_001.png",
      type: "",
      webkitRelativePath: "esriptorum_outputs/segmentation_line_crops/La115_1r_line_001.png",
    }),
    mockFile({
      name: "La115_1r_line_002.png",
      type: "",
      webkitRelativePath: "esriptorum_outputs/segmentation_line_crops/La115_1r_line_002.png",
    }),
  ];
  const groundTruthFiles = [
    mockFile({
      name: "La115_1r_line_001_gt.txt",
      type: "text/plain",
      webkitRelativePath: "esriptorum_outputs/segmentation_line_crops_gt/La115_1r_line_001_gt.txt",
      content: "line 1",
    }),
    mockFile({
      name: "La115_1r_line_002_gt.txt",
      type: "text/plain",
      webkitRelativePath: "esriptorum_outputs/segmentation_line_crops_gt/La115_1r_line_002_gt.txt",
      content: "line 2",
    }),
  ];

  const collectedImages = collectImageFolderFiles(imageFiles);
  const collectedGroundTruth = await collectGroundTruthFolderFiles(groundTruthFiles);

  assert.deepEqual(
    collectedImages.map((entry) => entry.sampleId),
    ["La115_1r_line_001", "La115_1r_line_002"],
  );
  assert.equal(collectedGroundTruth.get("La115_1r_line_001"), "line 1");
  assert.equal(collectedGroundTruth.get("La115_1r_line_002"), "line 2");
});
