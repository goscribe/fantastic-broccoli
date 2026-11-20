import { test } from "node:test";
import assert from "node:assert/strict";
import { mediumIssueLabel, scoreChange, scoreText } from "./generation-eval";

test("known device problems get a plain label, unknown ones fall back to their words", () => {
  assert.equal(mediumIssueLabel("needs_drawing"), "Asks the student to draw or plot");
  assert.equal(mediumIssueLabel("something_new"), "something new");
});

test("a score shows one decimal, and a dash when nothing was assessed", () => {
  assert.equal(scoreText(7), "7.0");
  assert.equal(scoreText(6.25), "6.3");
  assert.equal(scoreText(null), "–");
});

test("the change against the last run is signed and rounded to one decimal", () => {
  assert.equal(scoreChange(7.4, 6.8), "+0.6 since last run");
  assert.equal(scoreChange(5, 6.5), "−1.5 since last run");
});

test("no change is shown when a run has no score or the score did not move", () => {
  assert.equal(scoreChange(7, 7), null);
  assert.equal(scoreChange(7.04, 7), null);
  assert.equal(scoreChange(null, 7), null);
  assert.equal(scoreChange(7, null), null);
  assert.equal(scoreChange(7, undefined), null);
});
