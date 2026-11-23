import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPlanAccess, hasUnlimitedGrant, isPaidConversion } from "./plan-access";

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

test("an admin grant (free top tier) has plan access, shows as unlimited, and is never a paid conversion", () => {
  const granted = { paid: false, complimentary: true, unlimitedGrant: true };
  assert.equal(hasPlanAccess(granted), true);
  assert.equal(hasUnlimitedGrant(granted), true);
  assert.equal(isPaidConversion(granted), false);
  // Even if the server only sent the grant flag.
  assert.equal(hasPlanAccess({ paid: false, unlimitedGrant: true }), true);
});

test("a granted user who also pays is still a paying customer, and still unlimited", () => {
  const both = { paid: true, complimentary: false, unlimitedGrant: true };
  assert.equal(hasPlanAccess(both), true);
  assert.equal(hasUnlimitedGrant(both), true);
  assert.equal(isPaidConversion(both), true);
});

test("no grant flag (older server, free or paying user) is not unlimited", () => {
  assert.equal(hasUnlimitedGrant({}), false);
  assert.equal(hasUnlimitedGrant({ unlimitedGrant: false }), false);
  assert.equal(hasUnlimitedGrant(null), false);
  assert.equal(hasUnlimitedGrant(undefined), false);
});
