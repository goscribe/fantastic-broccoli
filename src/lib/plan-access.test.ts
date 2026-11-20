import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlanAccess, isPaidConversion } from "./plan-access";

test("a paying user has plan access and is a paid conversion", () => {
  assert.equal(hasPlanAccess({ paid: true, complimentary: false }), true);
  assert.equal(isPaidConversion({ paid: true, complimentary: false }), true);
});

test("a complimentary grant hides the wall but is never a paid conversion", () => {
  assert.equal(hasPlanAccess({ paid: false, complimentary: true }), true);
  assert.equal(isPaidConversion({ paid: false, complimentary: true }), false);
  assert.equal(isPaidConversion({ paid: true, complimentary: true }), false);
});

test("a free user sees the wall; an older server without the flag behaves as before", () => {
  assert.equal(hasPlanAccess({ paid: false, complimentary: false }), false);
  assert.equal(hasPlanAccess({ paid: false }), false);
  assert.equal(isPaidConversion({ paid: true }), true);
});
