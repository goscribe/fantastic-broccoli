import { test } from "node:test";
import assert from "node:assert/strict";
import type { CitationsResult, MarkedResult, ReviewAllowance } from "./api/coursework";
import {
  allowanceCopy,
  bandCells,
  bandLabel,
  bandSpan,
  bandSpoken,
  citationHeadline,
  citationItems,
  compareDrafts,
  comparisonHeadline,
  componentTitle,
  countWords,
  feedbackAnchors,
  formatBand,
  gradeRange,
  groupRubrics,
  hasMarks,
  locateAnchors,
  ringSegments,
  resultMood,
  rubricLine,
  timeUntil,
  ultraPitch,
  wordStatus,
} from "./coursework";
import { SAMPLE_CITATIONS, SAMPLE_RESULT } from "./coursework-sample";
import { findQuote, quoteChanged } from "./quote-match";

test("a band is always written as a range, never a made-up single number", () => {
  assert.equal(formatBand(4, 5), "4–5");
  assert.equal(formatBand(5, 5), "5");
  assert.equal(bandLabel(4, 5, 6), "4–5 of 6");
  assert.equal(bandLabel(0, 0, 6), "0 of 6");
  assert.equal(bandSpoken(4, 5, 6), "4 to 5 marks out of 6");
  assert.equal(bandSpoken(1, 1, 6), "1 mark out of 6");
});

test("the track fills exactly the band's cells", () => {
  assert.deepEqual(bandCells(4, 5, 6), [false, false, false, true, true, false]);
  assert.deepEqual(bandCells(0, 0, 4), [false, false, false, false]);
  assert.deepEqual(bandCells(0, 2, 4), [true, true, false, false]);
  assert.deepEqual(bandCells(5, 6, 6), [false, false, false, false, true, true]);
  assert.deepEqual(bandSpan(15, 19, 24), { start: (14 / 24) * 100, end: (19 / 24) * 100 });
  assert.deepEqual(bandSpan(0, 0, 24), { start: 0, end: 0 });
});

test("grades and the cat's mood come from the range", () => {
  assert.equal(gradeRange({ gradeLow: "5", gradeHigh: "6" }), "5–6");
  assert.equal(gradeRange({ gradeLow: "6", gradeHigh: "6" }), "6");
  assert.equal(gradeRange({ gradeLow: null, gradeHigh: null }), null);
  assert.equal(resultMood({ marksLow: 20, marksHigh: 23, totalMarks: 24 }), "strong");
  assert.equal(resultMood({ marksLow: 15, marksHigh: 19, totalMarks: 24 }), "okay");
  assert.equal(resultMood({ marksLow: 8, marksHigh: 11, totalMarks: 25 }), "rough");
});

const draft1: MarkedResult = {
  ...SAMPLE_RESULT,
  overall: { ...SAMPLE_RESULT.overall, marksLow: 13, marksHigh: 17 },
  criteria: SAMPLE_RESULT.criteria.map((c) => (c.letter === "A" ? { ...c, bandLow: 3, bandHigh: 4 } : c.letter === "D" ? { ...c, bandLow: 4, bandHigh: 5 } : c)),
};

test("comparing drafts says which criteria moved, by the middle of each band", () => {
  const cmp = compareDrafts(draft1, SAMPLE_RESULT)!;
  assert.deepEqual(
    cmp.rows.map((r) => [r.letter, r.move]),
    [
      ["A", "up"],
      ["B", "same"],
      ["C", "same"],
      ["D", "down"],
    ],
  );
  assert.equal(cmp.overall.move, "up");
  assert.deepEqual([cmp.up, cmp.down, cmp.same], [1, 1, 2]);
  assert.equal(comparisonHeadline(cmp), "1 criterion moved up, 1 moved down");
  assert.equal(comparisonHeadline({ up: 2, down: 0 }), "2 criteria moved up");
  assert.equal(comparisonHeadline({ up: 0, down: 0 }), "No criterion changed band");
});

test("a feedback-only draft has no marks to compare", () => {
  const feedback = { ...SAMPLE_RESULT, mode: "feedback" as const, overall: { summary: "" }, criteria: [] };
  assert.equal(hasMarks(feedback), false);
  assert.equal(compareDrafts(feedback, SAMPLE_RESULT), null);
  assert.equal(compareDrafts(null, SAMPLE_RESULT), null);
});

const now = new Date("2026-11-22T18:48:00Z");
const allowance = (o: Partial<ReviewAllowance>): ReviewAllowance => ({ tier: "pro", allowed: true, limit: 2, usedToday: 1, remainingToday: 1, reason: null, resetsAt: new Date("2026-11-23T00:00:00Z"), ...o });
const ultra = { priceAboveProDollars: 20 };

test("the allowance line: reviews left, the limit, Ultra only when it is sold", () => {
  assert.equal(allowanceCopy(allowance({}), ultra, now).line, "1 of 2 reviews left today");
  assert.equal(allowanceCopy(allowance({ usedToday: 0, remainingToday: 2 }), ultra, now).line, "2 of 2 reviews left today");
  const limit = allowanceCopy(allowance({ allowed: false, usedToday: 2, remainingToday: 0, reason: "daily_limit" }), ultra, now);
  assert.equal(limit.state, "limit");
  assert.equal(limit.line, "You've used today's 2 reviews");
  assert.equal(limit.resets, "Your next review unlocks at midnight, in 5 h 12 min.");
  assert.equal(limit.upsell, "Unlimited reviews with Ultra — +$20/month");
  // Ultra not configured: the limit only says when reviews come back.
  assert.equal(allowanceCopy(allowance({ allowed: false, usedToday: 2, remainingToday: 0, reason: "daily_limit" }), null, now).upsell, null);
  assert.equal(ultraPitch(null), null);
});

test("free is locked, Ultra is unlimited and never sold Ultra", () => {
  assert.equal(allowanceCopy(allowance({ tier: "free", allowed: false, limit: 0, remainingToday: 0, reason: "locked" }), ultra, now).state, "locked");
  const u = allowanceCopy(allowance({ tier: "ultra", limit: null, remainingToday: null }), ultra, now);
  assert.deepEqual([u.state, u.line], ["unlimited", "Unlimited reviews"]);
  const capped = allowanceCopy(allowance({ tier: "ultra", limit: null, remainingToday: null, allowed: false, reason: "abuse_cap" }), ultra, now);
  assert.equal(capped.state, "limit");
  assert.equal(capped.upsell, null);
});

test("time until the reset", () => {
  assert.equal(timeUntil(new Date("2026-11-23T00:00:00Z"), now), "in 5 h 12 min");
  assert.equal(timeUntil(new Date("2026-11-22T19:00:00Z"), now), "in 12 min");
  assert.equal(timeUntil(new Date("2026-11-22T20:48:00Z"), now), "in 2 h");
  assert.equal(timeUntil(new Date("2026-11-22T18:48:20Z"), now), "in under a minute");
});

test("words against the limit: calm notes when short or over", () => {
  assert.equal(countWords("  one two\nthree  "), 3);
  assert.equal(countWords(""), 0);
  assert.deepEqual(wordStatus(2184, 2200), { state: "ok", count: "2,184 of 2,200 words", note: null });
  assert.equal(wordStatus(40, 3000).state, "short");
  assert.equal(wordStatus(40, 3000).note, "Add at least 150 words for a review. 110 to go.");
  const over = wordStatus(1120, 950);
  assert.equal(over.state, "over");
  assert.equal(over.note, "170 over the limit. Examiners stop reading at 950 words, so the review does too.");
  assert.equal(wordStatus(900, null).count, "900 words");
  assert.equal(wordStatus(0, 3000).state, "empty");
});

const rubric = (id: string, subject: string, component: string, componentKind: "internal_assessment" | "extended_essay" | "tok_essay", suggested = false) => ({ id, subject, component, componentKind, board: "IB", qualification: "IB Diploma", sessionLabel: "first assessment 2025", suggested });

test("rubric names and the picker's groups", () => {
  const bio = rubric("b", "Biology", "Internal Assessment", "internal_assessment", true);
  const ee = rubric("e", "All subjects", "Extended Essay", "extended_essay");
  const chem = rubric("c", "Chemistry", "Internal Assessment", "internal_assessment");
  assert.equal(componentTitle(bio), "Biology IA");
  assert.equal(componentTitle(ee), "Extended Essay");
  assert.equal(componentTitle({ subject: "English A", component: "HL essay", componentKind: "coursework" }), "English A HL essay");
  assert.equal(rubricLine(bio), "IB Biology IA · first assessment 2025");
  assert.equal(rubricLine(ee), "IB EE · first assessment 2025");
  const groups = groupRubrics([chem, ee, bio], "");
  assert.deepEqual(groups.map((g) => [g.id, g.rubrics.map((r) => r.id)]), [["yours", ["b"]], ["core", ["e"]], ["ia", ["c"]]]);
  // A search flattens: the student's own are no longer pulled out.
  assert.deepEqual(groupRubrics([chem, ee, bio], "bio").map((g) => [g.id, g.rubrics.map((r) => r.id)]), [["ia", ["b"]]]);
  assert.deepEqual(groupRubrics([chem, ee, bio], "zzz"), []);
});

test("citation issues: one flat list, and a missing source is never called fake", () => {
  const items = citationItems(SAMPLE_CITATIONS);
  assert.equal(items.length, 7);
  assert.equal(citationHeadline(items.length), "7 issues to fix");
  assert.equal(citationHeadline(1), "1 issue to fix");
  assert.equal(citationHeadline(0), "No issues found");
  const notFound = items.find((i) => i.kind === "not_found")!;
  assert.equal(notFound.label, "Couldn't find this source");
  assert.match(notFound.fix, /Check the DOI/);
  assert.ok(items.every((i) => !/fake|fabricat|invented/i.test(`${i.label} ${i.problem} ${i.fix}`)));
  const entry = items.find((i) => i.kind === "entry")!;
  assert.equal(entry.problem, "This reference is missing its date and access date.");
  assert.ok(entry.format);
  assert.deepEqual(citationItems(null), []);
  const clean: CitationsResult = { ...SAMPLE_CITATIONS, inconsistencies: [], citedNotListed: [], listedNotCited: [], uncitedClaims: [], entries: [] };
  assert.deepEqual(citationItems(clean), []);
});

test("quotes are found by their words, and stop matching once edited", () => {
  const text = "The results show that the rate rises.\nThis proves that 35 °C is the  optimum temperature for catalase in potato tissue, which agrees with the literature value.";
  const [r] = findQuote(text, "“This proves that 35 °C is the optimum temperature for catalase”");
  assert.equal(text.slice(r.start, r.end), "This proves that 35 °C is the  optimum temperature for catalase");
  // An ellipsis joins parts found in order.
  const parts = findQuote(text, "The results show … agrees with the literature value");
  assert.deepEqual(parts.map((p) => text.slice(p.start, p.end)), ["The results show", "agrees with the literature value"]);
  assert.equal(quoteChanged(text, "This proves that 35 °C is the optimum"), false);
  assert.equal(quoteChanged(text.replace("proves", "suggests"), "This proves that 35 °C is the optimum"), true);
  // Whole words only.
  assert.equal(quoteChanged("the cat sat", "he cat"), true);
  assert.deepEqual(findQuote(text, "  "), []);
});

test("every quoted passage becomes an anchor that points at its feedback", () => {
  const anchors = feedbackAnchors(SAMPLE_RESULT, SAMPLE_CITATIONS);
  assert.equal(anchors.filter((a) => a.target.kind === "criterion").length, 8);
  assert.deepEqual(anchors[0], { id: "A-0", quote: SAMPLE_RESULT.criteria[0].evidence[0].quote, target: { kind: "criterion", letter: "A" } });
  // Citation anchors: only what sits in the body text (claims, in-text citations), not bibliography entries.
  assert.deepEqual(anchors.filter((a) => a.target.kind === "citation").map((a) => a.id), ["cite-cnl-0", "cite-claim-0", "cite-claim-1"]);
});


test("a quoted passage is placed by the heading above it, or its paragraph number", () => {
  const h = (text: string) => ({ type: "heading", content: [{ type: "text", text }] });
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const doc = { type: "doc", content: [p("An opening line with no heading above it."), h("Method"), p("Potato cylinders were cut to roughly the same size."), h("Conclusion"), p("This proves that 35 °C is the optimum.")] };
  const places = locateAnchors(doc, [
    { id: "C-0", quote: "This proves that 35 °C is the optimum" },
    { id: "A-1", quote: "cut to roughly the same size" },
    { id: "X-0", quote: "an opening line" },
    { id: "gone", quote: "words that were edited away" },
  ]);
  assert.deepEqual([...places.entries()], [["X-0", "Paragraph 1"], ["A-1", "Method"], ["C-0", "Conclusion"]]);
  assert.equal(locateAnchors(null, [{ id: "a", quote: "anything at all" }]).size, 0);
});

test("the ring gives each criterion its share and draws its band along it", () => {
  const segs = ringSegments([{ letter: "A", maxMarks: 6, bandLow: 3, bandHigh: 6 }, { letter: "B", maxMarks: 18, bandLow: 9, bandHigh: 9 }], 0.02);
  assert.deepEqual(segs.map((s) => [s.letter, +s.start.toFixed(2), +s.end.toFixed(2), s.low, s.high]), [["A", 0.01, 0.24, 0.5, 1], ["B", 0.26, 0.99, 0.5, 0.5]]);
  assert.deepEqual(ringSegments([]), []);
});
