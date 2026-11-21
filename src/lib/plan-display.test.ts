import { test } from "node:test";
import assert from "node:assert/strict";
import { planBilling, planCta, planDescription, planDisplayName, planPriceInline, planPriceLabel, planTermsLine, planTrialDays } from "./plan-display";

const free = { name: "free", priceDollars: 0, description: "Free", interval: "month" };
const starter = { name: "starter", priceDollars: 5, description: "Student price", interval: "month" };
const yearly = { name: "Pro yearly", priceDollars: 48, interval: "year" };
const pass = { name: "Exam Pass 2027", priceDollars: 29, description: "Pay once", interval: null, kind: "pass", accessUntil: "2027-07-15T23:59:59.000Z" };

test("plan ids become display names; written names are kept", () => {
  assert.equal(planDisplayName("free"), "Free");
  assert.equal(planDisplayName("starter"), "Starter");
  assert.equal(planDisplayName("exam_pass"), "Exam Pass");
  assert.equal(planDisplayName("Exam Pass 2027"), "Exam Pass 2027");
  assert.equal(planDisplayName("  "), "Plan");
});

test("a description that only repeats the name is dropped", () => {
  assert.equal(planDescription(free), null);
  assert.equal(planDescription(starter), "Student price");
});

test("the price suffix follows the billing interval", () => {
  assert.deepEqual(planPriceLabel(free), { amount: "Free", suffix: "" });
  assert.deepEqual(planPriceLabel(starter), { amount: "$5", suffix: " / month" });
  assert.deepEqual(planPriceLabel(yearly), { amount: "$48", suffix: " / year" });
  assert.deepEqual(planPriceLabel({ name: "old", priceDollars: 9 }), { amount: "$9", suffix: " / month" }, "no interval field = monthly, as before");
});

test("the one-off pass is never labelled per month", () => {
  assert.equal(planBilling(pass), "once");
  assert.deepEqual(planPriceLabel(pass), { amount: "$29", suffix: " once" });
  assert.equal(planPriceInline(pass), "$29 once");
  assert.equal(planBilling({ name: "p", priceDollars: 29, kind: "pass" }), "once", "kind alone marks a pass");
  assert.equal(planBilling({ name: "p", priceDollars: 29, interval: null }), "once", "a null interval alone marks a one-off");
  for (const text of [planPriceLabel(pass).suffix, planPriceInline(pass), planTermsLine(pass, 7) ?? ""]) {
    assert.doesNotMatch(text, /month|after 7 days|trial/i);
  }
});

test("only a subscription has a trial, and the terms line says what is charged when", () => {
  assert.equal(planTrialDays(starter, 7), 7);
  assert.equal(planTrialDays(pass, 7), 0);
  assert.equal(planTrialDays(free, 7), 0);
  assert.equal(planTermsLine(starter, 7), "$0 today, then $5/month after 7 days. Cancel before then and pay nothing.");
  assert.equal(planTermsLine(yearly, 7), "$0 today, then $48/year after 7 days. Cancel before then and pay nothing.");
  assert.equal(planTermsLine(starter, 0), null);
  assert.equal(planTermsLine(starter, 7, { afterZeroToday: true }), "Then $5/month after 7 days. Cancel before then and pay nothing.");
  assert.equal(planTermsLine(pass, 7, { afterZeroToday: true }), "One payment. Access until Jul 15, 2027.");
  assert.equal(planTermsLine(pass, 7), "One payment. Access until Jul 15, 2027.");
  assert.equal(planTermsLine({ ...pass, accessUntil: null }, 7), "One payment. No subscription.");
  assert.equal(planTermsLine(free, 7), null);
});

test("button wording: Try for free for a trial subscription, Get started for the pass", () => {
  assert.equal(planCta(starter, 7), "Try for free");
  assert.equal(planCta(pass, 7), "Get started");
  assert.equal(planCta(starter, 0), "Get started", "no trial left: do not promise one");
});
