import { test } from "node:test";
import assert from "node:assert/strict";
import { pastedSubjectTitle, topicStart, uploadSubjectTitle } from "./first-run";
import { clampMs, funnelPayload } from "./funnel";

test("typed topics keep their wording and pick up the exam board", () => {
  assert.deepEqual(topicStart("  IB Physics –   atomic structure "), {
    title: "IB Physics – atomic structure",
    topics: "IB Physics – atomic structure",
    examBoard: "IB",
  });
  assert.equal(topicStart("AP Bio cell transport")?.examBoard, "AP");
  assert.equal(topicStart("A-level Chemistry bonding")?.examBoard, "A_LEVEL");
  assert.equal(topicStart("GCSE maths")?.examBoard, "GCSE");
  assert.equal(topicStart("organic chemistry")?.examBoard, undefined);
  // "ap" inside a word is not a board.
  assert.equal(topicStart("maps and apps")?.examBoard, undefined);
  assert.equal(topicStart(" x "), null);
});

test("pasted notes are named after their first line", () => {
  assert.equal(pastedSubjectTitle("# Cell transport\nDiffusion is…", "Pasted notes"), "Cell transport");
  assert.equal(
    pastedSubjectTitle("Diffusion is the net movement of particles from high to low concentration", "Pasted notes"),
    "Diffusion is the net movement of particles from",
  );
  assert.equal(pastedSubjectTitle("\n\n", "Pasted notes"), "Pasted notes");
});

test("uploads are named after the file unless it is a camera photo", () => {
  assert.equal(uploadSubjectTitle(["bio_unit-3.pdf"], "My notes"), "bio unit 3");
  assert.equal(uploadSubjectTitle(["IMG_2041.jpg"], "My notes"), "My notes");
  assert.equal(uploadSubjectTitle(["PXL_20261120_101010.jpg", "IMG_1.jpg"], "My notes"), "My notes");
  assert.equal(uploadSubjectTitle(["Chem notes.pdf", "b.pdf"], "My notes"), "Chem notes +1");
});

test("funnel payloads carry only clean numbers and the device hints", () => {
  assert.deepEqual(
    funnelPayload("first_run.upload_finished", { option: "camera", durationMs: 1234.6, fileCount: 1, sizeKb: undefined }, { now: 0, viewportWidth: 390.4, touch: true, sinceFirstScreen: -5 }, "w1"),
    {
      event: "first_run.upload_finished",
      workspaceId: "w1",
      props: { option: "camera", durationMs: 1235, fileCount: 1, msSinceFirstScreen: 0, viewportWidth: 390, touch: true },
    },
  );
  assert.equal(clampMs(1e12), 86_400_000);
});
