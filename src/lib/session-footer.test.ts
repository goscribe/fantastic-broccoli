import { test } from "node:test";
import assert from "node:assert/strict";
import { footerBackStep, footerNextStep, nextUnanswered, sessionFinished, showSessionFooter, unfinishedSummary } from "./session-footer";

test("a one-activity session (Quick 5) has no bottom bar", () => {
  assert.equal(showSessionFooter(1), false);
  assert.equal(showSessionFooter(0), false);
  assert.equal(showSessionFooter(2), true);
});

test("Next moves to the next question first, then the next activity, then the summary", () => {
  assert.equal(footerNextStep({ canItemNext: true, activeIndex: 0, activityCount: 3 }), "item");
  assert.equal(footerNextStep({ canItemNext: false, activeIndex: 0, activityCount: 3 }), "activity");
  assert.equal(footerNextStep({ canItemNext: false, activeIndex: 2, activityCount: 3 }), "summary");
  // Already on the summary: nowhere to go.
  assert.equal(footerNextStep({ canItemNext: false, activeIndex: 3, activityCount: 3 }), "none");
});

test("Back moves to the previous question first, then the previous activity", () => {
  assert.equal(footerBackStep({ canItemBack: true, activeIndex: 0 }), "item");
  assert.equal(footerBackStep({ canItemBack: false, activeIndex: 1 }), "activity");
  assert.equal(footerBackStep({ canItemBack: false, activeIndex: 0 }), "none");
});

test("the end screen celebrates only finished work", () => {
  assert.equal(sessionFinished([]), false);
  assert.equal(sessionFinished([{ status: "completed" }, { status: "skipped" }]), true);
  assert.equal(sessionFinished([{ status: "completed" }, { status: "in_progress" }]), false);
  assert.equal(sessionFinished([{ status: "pending" }]), false);
});

test("an unfinished session says what is left and resumes where the student was", () => {
  const acts = [
    { id: "a", status: "completed", estimatedMinutes: 3 },
    { id: "b", status: "pending", estimatedMinutes: 4 },
    { id: "c", status: "in_progress", estimatedMinutes: 2.4 },
  ];
  assert.deepEqual(unfinishedSummary(acts), { left: 2, minutes: 6, resumeId: "c" });
  assert.deepEqual(unfinishedSummary([{ id: "x", status: "pending" }]), { left: 1, minutes: 1, resumeId: "x" });
  assert.deepEqual(unfinishedSummary([{ id: "x", status: "completed" }]), { left: 0, minutes: 0, resumeId: null });
});

test("a quiz goes back to questions passed over before it can finish", () => {
  assert.equal(nextUnanswered([1, null, 2, null, 0], 4), 1);
  assert.equal(nextUnanswered([1, null, 2, null, 0], 1), 3);
  assert.equal(nextUnanswered([1, 0, 2], 2), null);
  assert.equal(nextUnanswered([null], 0), 0);
});
