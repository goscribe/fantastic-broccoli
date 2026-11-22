import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ULTRA_UPSELL,
  bandLabel,
  findQuoteInText,
  graderGate,
  graderWallVariant,
  highlightSpans,
  isGraderLimitError,
  overallLabel,
  pollDelayMs,
  remainingLine,
  reviewsPerDayLabel,
  wordCountState,
} from "./grader";
import { courseworkPerk, paidPerks, wallReason } from "./wall";
import type { GraderStatus, MarkedResult } from "./api/grader";

const status = (over: Partial<GraderStatus> = {}): GraderStatus => ({
  tier: "pro",
  allowed: true,
  reason: null,
  limit: 2,
  usedToday: 0,
  remainingToday: 2,
  resetsAt: new Date("2026-11-23T00:00:00Z"),
  timezone: "Europe/London",
  ultraAvailable: false,
  ultraPlanId: null,
  ...over,
});

test("the gate follows the server: hidden without a grader, locked on free, limit when used up", () => {
  assert.equal(graderGate(false), "hidden");
  assert.equal(graderGate(null), "hidden");
  assert.equal(graderGate(status()), "ready");
  assert.equal(graderGate(status({ tier: "free", allowed: false, reason: "locked", limit: 0, remainingToday: 0 })), "locked");
  assert.equal(graderGate(status({ allowed: false, reason: "daily_limit", usedToday: 2, remainingToday: 0 })), "limit");
  assert.equal(graderGate(status({ tier: "ultra", allowed: false, reason: "abuse_cap", limit: null, remainingToday: null })), "limit");
  assert.equal(graderWallVariant("locked"), "locked");
  assert.equal(graderWallVariant("limit"), "limit");
  assert.equal(graderWallVariant("ready"), null);
});

test("limit refusals are recognised and classed as the grader wall", () => {
  const msg = "Coursework review limit: your plan includes 2 reviews a day. You can review again tomorrow.";
  assert.ok(isGraderLimitError(msg));
  assert.ok(!isGraderLimitError("Review not found"));
  assert.equal(wallReason(msg), "grader");
  assert.equal(wallReason("Coursework review limit: coursework reviews come with Pro and Ultra."), "grader");
});

test("plan lines: Pro 2 a day, Ultra unlimited, nothing for plans without reviews or older servers", () => {
  assert.equal(reviewsPerDayLabel(2), "2 reviews a day");
  assert.equal(reviewsPerDayLabel(1), "1 review a day");
  assert.equal(reviewsPerDayLabel(null), "Unlimited reviews");
  assert.equal(reviewsPerDayLabel(0), null);
  assert.equal(reviewsPerDayLabel(undefined), null);
  assert.equal(courseworkPerk(2), "2 coursework reviews a day");
  assert.equal(courseworkPerk(null), "Unlimited coursework reviews");
  assert.equal(courseworkPerk(0), null);
  assert.equal(ULTRA_UPSELL, "Unlimited reviews with Ultra — +$20/month");
});

test("paid perks add the coursework line from the server, and keep the billing line last", () => {
  const base = { name: "pro", priceDollars: 19, interval: "month", monthlyTokens: 2000 };
  const pro = paidPerks({ ...base, courseworkReviewsPerDay: 2 });
  assert.ok(pro.includes("2 coursework reviews a day"));
  assert.equal(pro.at(-1), "Renews every month, cancel anytime");
  const ultra = paidPerks({ ...base, name: "ultra", priceDollars: 39, courseworkReviewsPerDay: null });
  assert.ok(ultra.includes("Unlimited coursework reviews"));
  assert.ok(!paidPerks({ ...base, name: "starter", courseworkReviewsPerDay: 0 }).some((l) => /coursework/.test(l)));
  assert.ok(!paidPerks(base).some((l) => /coursework/.test(l)), "older server: no line");
});

test("remaining and word count lines", () => {
  assert.equal(remainingLine(status({ remainingToday: 1 })), "1 of 2 reviews left today");
  assert.equal(remainingLine(status({ remainingToday: 0 })), "No reviews left today");
  assert.equal(remainingLine(status({ limit: null, remainingToday: null })), "Unlimited reviews");
  assert.deepEqual(wordCountState(3850, 4000), { words: 3850, limit: 4000, label: "3,850 / 4,000 words", tone: "near", over: 0 });
  assert.equal(wordCountState(4120, 4000).tone, "over");
  assert.equal(wordCountState(4120, 4000).over, 120);
  assert.equal(wordCountState(1200, 4000).tone, "ok");
  assert.equal(wordCountState(900, null).label, "900 words");
});

test("band and overall labels; feedback mode has no overall marks", () => {
  assert.equal(bandLabel(4, 5, 6), "4–5 / 6");
  assert.equal(bandLabel(6, 6, 6), "6 / 6");
  const marked = { mode: "marked", overall: { marksLow: 19, marksHigh: 23, totalMarks: 30, gradeLow: null, gradeHigh: null, summary: "" } } as unknown as MarkedResult;
  assert.equal(overallLabel(marked), "19–23 / 30");
  assert.equal(overallLabel({ ...marked, overall: { ...marked.overall, gradeLow: "B", gradeHigh: "A" } }), "19–23 / 30 · B–A");
  assert.equal(overallLabel({ mode: "feedback", overall: { summary: "x" } } as never), null);
  assert.equal(pollDelayMs(1000), 3000);
  assert.equal(pollDelayMs(60_000), 5000);
});

test("highlight spans are sorted, inside the text and never overlap", () => {
  const spans = highlightSpans(
    [
      { letter: "A", evidence: [{ quote: "", comment: "", start: 10, end: 20 }, { quote: "", comment: "", start: 50, end: 60 }] },
      { letter: "B", evidence: [{ quote: "", comment: "", start: 15, end: 25 }, { quote: "", comment: "", start: 0, end: 5 }, { quote: "", comment: "", start: 90, end: 120 }] },
    ],
    100,
  );
  assert.deepEqual(spans, [
    { start: 0, end: 5, letter: "B" },
    { start: 10, end: 20, letter: "A" },
    { start: 50, end: 60, letter: "A" },
  ]);
});

test("a quote is found again in edited text, or reported gone", () => {
  const text = "Intro.\n\nThe yield rose by  12% when\nthe temperature increased.";
  assert.deepEqual(findQuoteInText("yield rose", text), { start: 12, end: 22 });
  const loose = findQuoteInText("rose by 12% when the temperature", text);
  assert.ok(loose && text.slice(loose.start, loose.end).startsWith("rose by"));
  assert.equal(findQuoteInText("this sentence was deleted", text), null);
});
