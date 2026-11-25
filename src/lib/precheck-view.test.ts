import { test } from "node:test";
import assert from "node:assert/strict";
import { precheckShown, precheckView } from "./precheck-view";

test("an empty check (nothing matches the session) goes straight to the warm-up", () => {
  assert.equal(precheckView([], false), "warmup");
});

test("with no warm-up question either, nothing is shown: the full progress view, no empty card", () => {
  assert.equal(precheckShown(precheckView([], false), false), false);
  assert.equal(precheckShown(precheckView([], false), true), true);
});

test("while the check loads nothing is shown", () => {
  assert.equal(precheckView(null, false), "loading");
  assert.equal(precheckShown("loading", true), false);
});

test("topics give the check; Skip gives the warm-up", () => {
  assert.equal(precheckView([{ topic: "normal distribution" }], false), "check");
  assert.equal(precheckShown("check", false), true);
  assert.equal(precheckView([{ topic: "normal distribution" }], true), "warmup");
});
