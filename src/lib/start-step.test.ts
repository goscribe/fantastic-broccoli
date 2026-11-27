import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStartAnswer,
  confidenceEffectKey,
  paperAsked,
  practiceStart,
  startCheckAnswers,
  startKind,
  startStepAsks,
  startStepShown,
  type StartOptions,
} from "./start-step";

const PAPERS = [
  { id: "p1", name: "Paper 1", blurb: "Multiple choice" },
  { id: "p2", name: "Paper 2", blurb: "Structured questions" },
];
const options = (over: Partial<StartOptions> = {}): StartOptions => ({ askConfidence: false, askTopicIds: [], papers: [], paperId: null, paperChosen: false, ...over });

test("nothing due: no screen, the session starts at once", () => {
  const asks = startStepAsks({ lengthDue: false, options: options(), skipped: false, quickStart: false });
  assert.deepEqual(asks, { length: false, confidence: false, paper: false });
  assert.equal(startStepShown(asks, false), false);
  // No server answer (offline, an older server) and no length to ask: no screen either.
  assert.equal(startStepShown(startStepAsks({ lengthDue: false, options: null, skipped: false, quickStart: true }), true), false);
});

test("the screen opens for the length, the confidence, or a paper still to choose for a full session", () => {
  assert.equal(startStepShown(startStepAsks({ lengthDue: true, options: null, skipped: false, quickStart: true }), true), true);
  assert.equal(startStepShown(startStepAsks({ lengthDue: false, options: options({ askConfidence: true }), skipped: false, quickStart: true }), true), true);
  const paper = startStepAsks({ lengthDue: false, options: options({ papers: PAPERS }), skipped: false, quickStart: false });
  assert.equal(paper.paper, true);
  assert.equal(startStepShown(paper, false), true);
  // A Quick 5 is five multiple-choice questions: a paper alone changes nothing, so it is not asked.
  assert.equal(startStepShown(paper, true), false);
});

test("a paper is asked once per course; one paper is no choice; Skip quiets both questions but not the length", () => {
  assert.equal(startStepAsks({ lengthDue: false, options: options({ papers: PAPERS, paperChosen: true }), skipped: false, quickStart: false }).paper, false);
  assert.equal(startStepAsks({ lengthDue: false, options: options({ papers: PAPERS.slice(0, 1) }), skipped: false, quickStart: false }).paper, false);
  // An older server does not say: the paper then rides only with the confidence question.
  assert.equal(startStepAsks({ lengthDue: false, options: options({ papers: PAPERS, paperChosen: undefined }), skipped: false, quickStart: false }).paper, false);
  assert.equal(startStepAsks({ lengthDue: false, options: options({ papers: PAPERS, paperChosen: undefined, askConfidence: true }), skipped: false, quickStart: false }).paper, true);
  const skipped = startStepAsks({ lengthDue: true, options: options({ askConfidence: true, papers: PAPERS }), skipped: true, quickStart: false });
  assert.deepEqual(skipped, { length: true, confidence: false, paper: false });
});

test("what the session will be follows the choices on the screen", () => {
  assert.equal(startKind({ mode: "practice", quickStart: true }), "quick5");
  assert.equal(startKind({ mode: "practice", quickStart: true, minutes: 10 }), "quick5");
  assert.equal(startKind({ mode: "practice", quickStart: true, minutes: 15 }), "session");
  assert.equal(startKind({ mode: "practice", quickStart: false }), "session");
  assert.equal(startKind({ mode: "study", quickStart: true, minutes: 5 }), "study");
  const asks = { length: false, confidence: true, paper: true };
  assert.equal(paperAsked(asks, "session"), true);
  assert.equal(paperAsked(asks, "quick5"), false);
  assert.equal(paperAsked(asks, "study"), false);
});

test("the line under the slider says what the rating changes in this kind of session", () => {
  assert.equal(confidenceEffectKey(2, "study"), "startStep.study.low");
  assert.equal(confidenceEffectKey(6, "study"), "startStep.study.medium");
  assert.equal(confidenceEffectKey(9, "study"), "startStep.study.high");
  assert.equal(confidenceEffectKey(2, "quick5"), "quick5Conf.next.gentle");
  assert.equal(confidenceEffectKey(9, "quick5"), "quick5Conf.next.hard");
  assert.equal(confidenceEffectKey(2, "session"), "startCheck.next.notes");
  assert.equal(confidenceEffectKey(6, "session"), "startCheck.next.recap");
  assert.equal(confidenceEffectKey(9, "session"), "startCheck.next.questions");
});

test("only what was asked is sent; nothing asked sends nothing", () => {
  assert.equal(startCheckAnswers({ mode: "practice" }, options()), undefined);
  assert.deepEqual(startCheckAnswers({ mode: "practice", confidence: 3 }, options({ askTopicIds: ["a", "b"] })), { confidence: 3, confidenceTopicIds: ["a", "b"] });
  assert.deepEqual(startCheckAnswers({ mode: "practice", confidence: 0, paperId: null }, options()), { confidence: 0, paperId: null });
  assert.deepEqual(startCheckAnswers({ mode: "practice", paperId: "p2" }, null), { paperId: "p2" });
});

test("Skip, or no screen, leaves the start exactly as it was", () => {
  const input = { workspaceId: "w", title: "Osmosis", depth: "light" as const, durationMinutes: 5, quickStart: true };
  assert.equal(applyStartAnswer(input, null, options()), input);
  assert.deepEqual(applyStartAnswer(input, { mode: "practice" }, options()), input);
});

test("practice: the length and the answers are applied as before", () => {
  const input = { workspaceId: "w", title: "Osmosis", depth: "light" as const, durationMinutes: 5, quickStart: true };
  const out = applyStartAnswer(input, { mode: "practice", minutes: 30, confidence: 4, paperId: "p1" }, options());
  assert.deepEqual(out, { ...input, depth: "moderate", durationMinutes: 30, quickStart: false, startCheck: { confidence: 4, paperId: "p1" } });
  assert.equal("mode" in out, false);
});

test('"Just study the topic": never a Quick 5, at least ten minutes, with the rating', () => {
  const quick = { workspaceId: "w", title: "Osmosis", depth: "light" as const, durationMinutes: 5, quickStart: true };
  assert.deepEqual(applyStartAnswer(quick, { mode: "study", confidence: 2 }, options()), {
    ...quick,
    mode: "study",
    quickStart: false,
    durationMinutes: 10,
    depth: "moderate",
    startCheck: { confidence: 2 },
  });
  // Their own length is kept (and its depth), down to the ten-minute floor.
  assert.deepEqual(applyStartAnswer(quick, { mode: "study", minutes: 45 }, options()), { ...quick, mode: "study", quickStart: false, durationMinutes: 45, depth: "moderate" });
  assert.equal(applyStartAnswer(quick, { mode: "study", minutes: 5 }, options()).durationMinutes, 10);
  const full = { workspaceId: "w", title: "Osmosis", depth: "deep" as const, durationMinutes: 60 };
  assert.deepEqual(applyStartAnswer(full, { mode: "study" }, options()), { ...full, mode: "study", quickStart: false });
});

test('"Ready for practice questions?" starts a full practice session on the same topics', () => {
  const base = { workspaceId: "w", title: "Cell membranes", depth: "moderate" as const, durationMinutes: 20 };
  assert.deepEqual(practiceStart({ ...base, courseTopic: "ib-biology:a1-1" }), { kind: "topic", courseId: "ib-biology", topicId: "a1-1" });
  assert.deepEqual(practiceStart({ ...base, courseTopic: "ib-biology:a1-1,a1-2" }), { kind: "topics", courseId: "ib-biology", topicIds: ["a1-1", "a1-2"] });
  const own = practiceStart({ ...base, topics: "membranes; transport", examBoard: "IB", description: "From my notes" });
  assert.deepEqual(own, {
    kind: "create",
    input: { ...base, description: "From my notes", examBoard: "IB", topics: "membranes; transport", quickStart: false },
  });
  // No topics stored: the title names it, so a course subject does not move on to its next topics.
  const untitled = practiceStart(base);
  assert.equal(untitled.kind === "create" && untitled.input.topics, "Cell membranes");
});
