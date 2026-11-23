import { test } from "node:test";
import assert from "node:assert/strict";
import { COURSEWORK_UPGRADE_HREF, courseworkAccess, creditsLeft, creditsLine, parsePricingQuery, pricingPick, type PickablePlan } from "./coursework-access";

test("access: open with plan reviews or credits, locked with neither (and on an older server, from the reason)", () => {
  assert.equal(courseworkAccess({ reason: "locked", access: false, creditsLeft: 0 }), "locked");
  assert.equal(courseworkAccess({ reason: null, access: true, creditsLeft: 5 }), "open");
  assert.equal(courseworkAccess({ reason: "daily_limit", access: true, creditsLeft: 0 }), "open", "Pro at its limit still has Coursework");
  // No `access` field: an older server.
  assert.equal(courseworkAccess({ reason: "locked" }), "locked");
  assert.equal(courseworkAccess({ reason: "locked", creditsLeft: 2 }), "open");
  assert.equal(courseworkAccess({ reason: null }), "open");
});

test("credits: never negative; the line is plural-aware and absent at zero", () => {
  assert.equal(creditsLeft({ creditsLeft: -1 }), 0);
  assert.equal(creditsLeft(null), 0);
  assert.equal(creditsLeft({ creditsLeft: 5 }), 5);
  assert.equal(creditsLine(5), "5 free reviews left");
  assert.equal(creditsLine(1), "1 free review left");
  assert.equal(creditsLine(0), null);
});

const FREE: PickablePlan = { id: "plan_free", name: "free", priceDollars: 0, isActive: true, courseworkReviewsPerDay: 0 };
const STARTER: PickablePlan = { id: "plan_starter", name: "starter", priceDollars: 5, isActive: false, courseworkReviewsPerDay: 0 };
const PRO: PickablePlan = { id: "plan_pro", name: "pro", priceDollars: 19, isActive: false, courseworkReviewsPerDay: 2 };
const ULTRA: PickablePlan = { id: "plan_ultra_202611", name: "ultra", priceDollars: 39, isActive: false, courseworkReviewsPerDay: null };
const PASS: PickablePlan = { id: "plan_pass", name: "exam_pass", priceDollars: 29, isActive: false, courseworkReviewsPerDay: 0 };

test("the locked Coursework link asks for Ultra, for coursework", () => {
  assert.deepEqual(parsePricingQuery(new URL(COURSEWORK_UPGRADE_HREF, "https://scribe.study").search), { plan: "ultra", for: "coursework" });
  assert.deepEqual(parsePricingQuery("?plan=Ultra"), { plan: "ultra", for: null });
  assert.deepEqual(parsePricingQuery(""), { plan: null, for: null });
});

test("pricing pick: Ultra when it is on sale; otherwise the plan the server lists with the most coursework reviews (Pro)", () => {
  const q = { plan: "ultra", for: "coursework" };
  assert.equal(pricingPick([FREE, STARTER, PRO, ULTRA, PASS], q), ULTRA.id);
  // Ultra's price not configured: the server does not list it. Pro, not a dead page.
  assert.equal(pricingPick([FREE, STARTER, PRO, PASS], q), PRO.id);
  // Decided from the caps the server returns, not plan names: a plan with more reviews wins whatever it is called.
  assert.equal(pricingPick([FREE, PRO, { ...STARTER, courseworkReviewsPerDay: 5 }], q), STARTER.id);
  // Never a plan the student already has, never the free plan.
  assert.equal(pricingPick([FREE, STARTER, { ...PRO, isActive: true }, ULTRA], q), ULTRA.id);
  assert.equal(pricingPick([FREE, STARTER, { ...PRO, isActive: true }], q), null);
  // No plan with coursework (or an older server that does not say): the page's own default.
  assert.equal(pricingPick([FREE, STARTER, PASS], q), null);
  assert.equal(pricingPick([FREE, { ...PRO, courseworkReviewsPerDay: undefined }], q), null);
  // `plan` alone picks that plan when it is listed; nothing otherwise.
  assert.equal(pricingPick([FREE, STARTER, PRO], { plan: "starter", for: null }), STARTER.id);
  assert.equal(pricingPick([FREE, STARTER, PRO], { plan: "ultra", for: null }), null);
  assert.equal(pricingPick([FREE, STARTER, PRO], { plan: null, for: null }), null);
});
