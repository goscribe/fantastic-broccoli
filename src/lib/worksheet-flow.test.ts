import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorksheetPart, WorksheetStep } from "@/types";
import {
  answerGuideFor,
  earlierAnswers,
  firstStepFor,
  modelAnswerFor,
  nextHelp,
  partsToMark,
  promptWithoutMarks,
  skippedMarking,
  stepScore,
} from "./worksheet-flow";

const scheme = { points: [{ point: 1, requirements: "Uses s = ½gt²" }, { point: 1, requirements: "t = 3.03 s" }], totalPoints: 2 };
const part = (over: Partial<WorksheetPart> = {}): WorksheetPart => ({ label: "a", prompt: "Calculate t. [2]", type: "numeric", marks: 2, answer: "3.03 s", markScheme: scheme, ...over });

test("each part says how much to write: the generator's guide, else from its type and marks", () => {
  assert.deepEqual(answerGuideFor(part({ answerGuide: "One line of working and the answer" })), { text: "One line of working and the answer" });
  assert.deepEqual(answerGuideFor(part()), { key: "written.guideWorking" });
  assert.deepEqual(answerGuideFor(part({ marks: 1 })), { key: "written.guideValue" });
  assert.deepEqual(answerGuideFor(part({ type: "text", marks: 2 })), { key: "written.guideSentences" });
  assert.deepEqual(answerGuideFor(part({ type: "text", marks: 1 })), { key: "written.guideLine" });
});

test("the marks already beside the prompt are not repeated at its end", () => {
  assert.equal(promptWithoutMarks("Calculate t. [2]", 2), "Calculate t.");
  assert.equal(promptWithoutMarks("Explain.\n(3 points)", 3), "Explain.");
  assert.equal(promptWithoutMarks("Explain. [2 marks]", 2), "Explain.");
  assert.equal(promptWithoutMarks("Find x [2]", 3), "Find x [2]"); // a different number stays
});

test("help: a hint first, then the first step; old parts fall back to the scheme's first point", () => {
  const withHelp = part({ hint: "Vertical motion only.", firstStep: "45.0 = ½(9.81)t²" });
  assert.equal(nextHelp(withHelp, 0), "hint");
  assert.equal(nextHelp(withHelp, 1), "step");
  assert.equal(nextHelp(withHelp, 2), null);
  assert.equal(firstStepFor(withHelp), "45.0 = ½(9.81)t²");
  const old = part();
  assert.equal(nextHelp(old, 0), "step"); // no hint: straight to the first step
  assert.equal(firstStepFor(old), "Uses s = ½gt²");
  assert.equal(firstStepFor(part({ markScheme: { points: [{ point: 1, requirements: "x" }], totalPoints: 1 } })), undefined);
});

test("the model answer is the worked answer, else the expected answer", () => {
  assert.equal(modelAnswerFor(part({ workedAnswer: "t = √(90/9.81) = 3.03 s" })), "t = √(90/9.81) = 3.03 s");
  assert.equal(modelAnswerFor(part()), "3.03 s");
  assert.equal(modelAnswerFor(part({ answer: undefined })), undefined);
});

const step: WorksheetStep = { title: "Projectile", parts: [part(), part({ label: "b" }), part({ label: "c", marks: 1 })] };

test("partial submission: Check marks only the answered, unmarked parts; never needs all of them", () => {
  const answered = (i: number) => i !== 1;
  assert.deepEqual(partsToMark(step, { answered, marked: () => false }), [0, 2]);
  assert.deepEqual(partsToMark(step, { answered, marked: (i) => i === 0 }), [2]);
  assert.deepEqual(partsToMark(step, { answered: () => false, marked: () => false }), []);
});

test("earlier answers ride along for error carried forward; blanks are left out", () => {
  const answers = ["t = 3.3 s", "", "x"];
  assert.deepEqual(earlierAnswers(step, 2, (i) => answers[i]), [{ partIndex: 0, answer: "t = 3.3 s" }]);
  assert.deepEqual(earlierAnswers(step, 0, (i) => answers[i]), []);
});

test("a skipped part scores 0 of its marks; the question totals every part", () => {
  assert.deepEqual(skippedMarking(part()), { points: [], achievedPoints: 0, totalPoints: 2, correct: false });
  const marks = [{ points: [], achievedPoints: 2, totalPoints: 2, correct: true }, skippedMarking(part())];
  assert.deepEqual(stepScore(step, (i) => marks[i]), { earned: 2, total: 5 });
});
