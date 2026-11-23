import assert from "node:assert/strict";
import { test } from "node:test";
import type { MarkedPoint, PartMarking, WorksheetContent } from "@/types";
import { aimWords, answerSegments, groupPoints, isLongAnswer, needsReview, promptParts } from "./long-answer";

const pt = (requirements: string, achievedPoints: number, quote = "", point = 1): MarkedPoint => ({ point, requirements, achievedPoints, feedback: "", quote });

test("an LAQ is a worksheet with format long_answer and a part", () => {
  const laq: WorksheetContent = { type: "worksheet", format: "long_answer", steps: [{ title: "t", parts: [{ label: "a", prompt: "Explain x. [6]", type: "essay", marks: 6 }] }] };
  assert.equal(isLongAnswer(laq), true);
  assert.equal(isLongAnswer({ ...laq, format: undefined }), false);
  assert.equal(isLongAnswer({ ...laq, steps: [] }), false);
});

test("the prompt shows its command term apart and loses the trailing marks", () => {
  assert.deepEqual(promptParts({ prompt: "Explain how ATP is made. [6]", commandTerm: "Explain" }), { term: "Explain", rest: " how ATP is made." });
  assert.deepEqual(promptParts({ prompt: "Evaluate the extent to which X changed. (6 points)", commandTerm: "Evaluate the extent to which" }).rest, " X changed.");
  assert.deepEqual(promptParts({ prompt: "Describe Y (6 marks)", commandTerm: "Explain" }), { term: "", rest: "Describe Y" });
  assert.equal(promptParts({ prompt: "Discuss Z [8 marks]." }).rest, "Discuss Z");
});

test("aim words scale with marks", () => {
  assert.equal(aimWords(6), 180);
  assert.equal(aimWords(1), 60);
});

test("earned quotes are highlighted in the answer, missed ones are not", () => {
  const answer = "Protons are pumped across. Oxygen accepts electrons.";
  const segs = answerSegments(answer, [pt("a", 1, "protons are pumped"), pt("b", 0, "Oxygen accepts electrons"), pt("c", 1, "not in answer")]);
  assert.deepEqual(segs, [
    { text: "Protons are pumped", point: 0 },
    { text: " across. Oxygen accepts electrons.", point: null },
  ]);
  assert.equal(segs.map((s) => s.text).join(""), answer);
});

test("overlapping quotes keep the first", () => {
  const segs = answerSegments("abc def ghi", [pt("a", 1, "abc def"), pt("b", 1, "def ghi")]);
  assert.deepEqual(segs.map((s) => s.point), [0, null]);
});

test("points group into earned and missed; under half marks needs review", () => {
  const marking: PartMarking = { points: [pt("a", 1), pt("b", 1, "", 2), pt("c", 0)], achievedPoints: 2, totalPoints: 4, correct: false };
  const { hit, missed } = groupPoints(marking);
  assert.deepEqual(hit.map((p) => p.requirements), ["a"]);
  assert.deepEqual(missed.map((p) => p.requirements), ["b", "c"]);
  assert.equal(needsReview(marking), false);
  assert.equal(needsReview({ ...marking, achievedPoints: 1 }), true);
});
