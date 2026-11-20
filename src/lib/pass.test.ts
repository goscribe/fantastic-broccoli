import { test } from "node:test";
import assert from "node:assert/strict";
import { fill, formatPassDate, isPass, monthsLeft, paidConversionPlan, passTitle, perMonth, shareTargets } from "./pass";

const pass27 = { id: "plan_pass_2027_exams", name: "Exam Pass 2027", kind: "pass" as const, accessUntil: "2027-07-15T23:59:59.000Z" };
const pass28 = { id: "plan_pass_2028_graduation", name: "Graduation Pass 2028", kind: "pass" as const, accessUntil: "2028-07-15T23:59:59.000Z" };
const starter = { id: "plan_starter_5usd_202611", name: "starter", kind: "recurring" as const, accessUntil: null };

test("passes get exam / graduation headlines with their year; monthly plans none", () => {
  assert.deepEqual(passTitle(pass27), { key: "bill.passExams", year: 2027 });
  assert.deepEqual(passTitle(pass28), { key: "bill.passGraduation", year: 2028 });
  assert.equal(passTitle(starter), null);
  assert.equal(isPass(starter), false);
  assert.equal(isPass(pass27), true);
});

test("pass dates are the UTC calendar day", () => {
  assert.equal(formatPassDate(pass27.accessUntil), "15 July 2027");
});

test("per-month value of a pass bought now", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  assert.equal(monthsLeft(pass27.accessUntil, now), 8);
  assert.equal(perMonth(29, pass27.accessUntil, now), 3.63);
});

test("share targets carry the message (with its link) to WhatsApp, Messages and email", () => {
  const t = shareTargets({ text: "Pay here https://scribe.study/pay/abc", subject: "Scribe" });
  assert.equal(t.whatsapp, "https://wa.me/?text=Pay%20here%20https%3A%2F%2Fscribe.study%2Fpay%2Fabc");
  assert.ok(t.sms.startsWith("sms:?&body=Pay%20here"));
  assert.ok(t.email.startsWith("mailto:?subject=Scribe&body="));
  assert.equal(fill("{name} pays {price}", { name: "Maya", price: "$29" }), "Maya pays $29");
});

test("the paid conversion uses the plan the server reports (a pass is worth 29), else the active plan", () => {
  const plans = [{ id: "plan_starter", priceDollars: 5, isActive: true }];
  assert.deepEqual(paidConversionPlan({ paidPlan: { id: pass27.id, price: 29 } }, plans), { id: pass27.id, price: 29 });
  assert.deepEqual(paidConversionPlan({ paidPlan: null }, plans), { id: "plan_starter", price: 5 });
  assert.deepEqual(paidConversionPlan({}, []), null);
});
