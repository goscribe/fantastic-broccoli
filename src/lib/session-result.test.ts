import test from "node:test";
import assert from "node:assert/strict";
import { bandCelebrates, questionTrail, resultBand, resultDots, runOfRight } from "./session-result";

test("resultBand: thresholds", () => {
  assert.equal(resultBand(null), "done");
  assert.equal(resultBand(undefined), "done");
  assert.equal(resultBand(1), "perfect");
  assert.equal(resultBand(0.92), "strong");
  assert.equal(resultBand(0.8), "strong");
  assert.equal(resultBand(0.79), "okay");
  assert.equal(resultBand(0.5), "okay");
  assert.equal(resultBand(0.49), "rough");
  assert.equal(resultBand(0), "rough");
});

test("bandCelebrates: only strong results get confetti", () => {
  assert.deepEqual(["perfect", "strong", "okay", "rough", "done"].map((b) => bandCelebrates(b as never)), [true, true, false, false, false]);
});

test("questionTrail: quiz picks, gap fills and card marks, in order", () => {
  const trail = questionTrail([
    { id: "r", type: "reading", content: { type: "reading" } },
    { id: "q", type: "mcq", content: { questions: [{ correctIndex: 1 }, { correctIndex: 0 }, { correctIndex: 2 }] }, draft: { answersByQ: [1, 2, null] } },
    { id: "c", type: "cloze", content: {}, draft: { results: [{ correct: true, feedback: "" }, { correct: false, feedback: "x" }] } },
    { id: "f", type: "flashcard_review", content: {}, draft: { results: [true, null, false] } },
  ]);
  assert.deepEqual(trail, [true, false, true, false, true, false]);
});

test("questionTrail: falls back to answers stored on the questions, and prefers the fresher draft", () => {
  const acts = [{ id: "q", type: "mcq", content: { questions: [{ correctIndex: 1, userAnswer: 1 }, { correctIndex: 0, userAnswer: 3 }] } }];
  assert.deepEqual(questionTrail(acts), [true, false]);
  assert.deepEqual(questionTrail(acts, () => ({ answersByQ: [0, 0] })), [false, true]);
  assert.deepEqual(questionTrail([{ id: "x", type: "mcq", content: null }]), []);
});

test("resultDots: real order when it matches the score, a tally otherwise", () => {
  assert.deepEqual(resultDots(3, 2, [true, false, true]), { dots: [true, false, true], ordered: true });
  assert.deepEqual(resultDots(4, 3, [true, false, true]), { dots: [true, true, true, false], ordered: false });
  assert.deepEqual(resultDots(3, 1, [true, true, false]), { dots: [true, false, false], ordered: false });
  assert.equal(resultDots(0, 0), null);
  assert.equal(resultDots(41, 30), null);
  assert.deepEqual(resultDots(2, 5), { dots: [true, true], ordered: false });
});

test("runOfRight: counts the right answers that end the run", () => {
  assert.equal(runOfRight([]), 0);
  assert.equal(runOfRight([true, true, true]), 3);
  assert.equal(runOfRight([true, false, true, true]), 2);
  assert.equal(runOfRight([true, true, false]), 0);
  assert.equal(runOfRight([true, true, null, true], 2), 2);
  assert.equal(runOfRight([true, null, true]), 1);
});
