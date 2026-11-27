import { test } from "node:test";
import assert from "node:assert/strict";
import { pastedSubjectTitle, shouldShowFirstRun, topicStart, topicTitle, uploadSubjectTitle } from "./first-run";
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

test("a pasted prompt is named after its topic, not the whole prompt", () => {
  // The subject behind 9 false QA alarms on 2026-11-27, as it reached topicStart (cut at 100 characters).
  const prompt = "**Topic: Artificial Intelligence (AI)** Create a detailed, student-friendly educational presentatio";
  const start = topicStart(prompt);
  assert.equal(start?.title, "Artificial Intelligence (AI)");
  // The planner still gets everything the student asked for.
  assert.equal(start?.topics, prompt);

  assert.equal(topicTitle("Topic: Photosynthesis. Create a detailed presentation for grade 9 students."), "Photosynthesis");
  assert.equal(topicTitle("# Cell transport\nExplain diffusion and osmosis with examples"), "Cell transport");
  assert.equal(topicTitle("The French Revolution: please write a summary with key dates"), "The French Revolution");
  assert.equal(topicTitle("Sujet : la stéréochimie. Explain it simply."), "la stéréochimie");
  assert.equal(topicTitle("`recursion` in **Python**"), "recursion in Python");
  // Capped at a word boundary.
  const long = topicTitle("The causes and the consequences of the First World War for the countries of central and eastern Europe");
  assert.equal(long, "The causes and the consequences of the First World War for the countries of");
  assert.ok(long.length <= 80);
});

test("ordinary typed topics are left as typed", () => {
  for (const topic of [
    "IB Physics – atomic structure",
    "Design and technology",
    "Make-up artistry",
    "organic chemistry: alkenes",
    "Create a study plan",
    "C++ pointers",
    "A-level Chemistry bonding",
    "World War 2. Causes",
  ])
    assert.equal(topicTitle(topic), topic, topic);
  // Only marks: nothing to name it by, so the typed text stays.
  assert.equal(topicTitle("**"), "**");
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

test("first run is only for a successful, empty answer; a failed load never looks like a new account", () => {
  const base = { treeFailed: false, workspaceCount: 0, skipped: false, sessionCounts: [] as (number | null)[] };
  assert.equal(shouldShowFirstRun(base), true, "no subjects at all");
  assert.equal(shouldShowFirstRun({ ...base, treeFailed: true }), false, "the subjects request failed");
  assert.equal(shouldShowFirstRun({ ...base, workspaceCount: 2, sessionCounts: [0, 0] }), true, "subjects but never studied");
  assert.equal(shouldShowFirstRun({ ...base, workspaceCount: 2, sessionCounts: [0, 3] }), false);
  assert.equal(shouldShowFirstRun({ ...base, workspaceCount: 2, sessionCounts: [0, null] }), false, "a failed sessions request is unknown, not zero");
  assert.equal(shouldShowFirstRun({ ...base, workspaceCount: 2, skipped: true, sessionCounts: [0, 0] }), false);
  assert.equal(shouldShowFirstRun({ ...base, workspaceCount: 7, sessionCounts: [] }), false, "established students skip the check");
});
