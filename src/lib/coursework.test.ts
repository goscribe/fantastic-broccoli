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
  guideVersions,
  guideYear,
  headingList,
  newestVersions,
  rubricFamily,
  versionName,
  draftEntries,
  draftKindLabel,
  hasMarks,
  locateAnchors,
  ringSegments,
  resultMood,
  rubricLine,
  timeUntil,
  ultraPitch,
  wordLine,
  wordStatus,
  criterionMark,
  estimateLabel,
  likelyLabel,
  likelyRange,
  prediction,
  predictionSpan,
  predictionSpoken,
  withEstimate,
} from "./coursework";
import { SAMPLE_CITATIONS, SAMPLE_RESULT } from "./coursework-sample";
import { countWork, resolveWordCountRules } from "./coursework-word-count";
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
  overall: { ...SAMPLE_RESULT.overall, marksEstimate: 16, marksLow: 15, marksHigh: 17 },
  criteria: SAMPLE_RESULT.criteria.map((c) => (c.letter === "A" ? { ...c, bandLow: 3, bandHigh: 4, mark: 4 } : c.letter === "D" ? { ...c, bandLow: 4, bandHigh: 5, mark: 5 } : c)),
};

test("comparing drafts says which criteria moved, by each best-estimate mark", () => {
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
  assert.deepEqual([cmp.overall.from.estimate, cmp.overall.to.estimate], [16, 17]);
  assert.deepEqual(cmp.rows[0].from, { low: 3, high: 4, mark: 4 });
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

test("words against the limit: calm notes when short or over; nothing is cut at the limit", () => {
  assert.equal(countWords("  one two\nthree  "), 3);
  assert.equal(countWords(""), 0);
  assert.deepEqual(wordStatus(2184, 2200), { state: "ok", count: "2,184 of 2,200 words", note: null, detail: null });
  assert.equal(wordStatus(40, 3000).state, "short");
  assert.equal(wordStatus(40, 3000).note, "Add at least 150 words for a review. 110 to go.");
  const over = wordStatus(1120, 950);
  assert.equal(over.state, "over");
  assert.equal(over.note, "170 over the limit. Examiners are not required to read past 950 words. Your whole work is still reviewed.");
  assert.doesNotMatch(over.note ?? "", /stop reading|so the review does too/);
  assert.equal(wordStatus(900, null).count, "900 words");
  assert.equal(wordStatus(0, 3000).state, "empty");
});

test("a count from a file is an estimate: 'About', what was left out, and the student's own count wins", () => {
  // The founder's case: 5,585 words in the file, about 1,915 of them count.
  const ia = wordLine({ counted: 1915, total: 5585, leftOut: "tables, appendices, bibliography, headings", estimate: true, limit: 2000 });
  assert.deepEqual(ia, { state: "ok", count: "About 1,915 words counted of 2,000", note: null, detail: "3,670 not counted (tables, appendices, bibliography, headings)" });
  const over = wordLine({ counted: 2143, total: 5585, leftOut: "tables", estimate: true, limit: 2000 });
  assert.equal(over.state, "over");
  assert.equal(over.note, "About 140 over the limit by Scribe's count, which is an estimate from your file. Check it against your own word count. Your whole work is still reviewed.");
  // "My word count is 1,996": the estimate no longer decides.
  const mine = wordLine({ counted: 2143, total: 5585, estimate: true, limit: 2000, declared: 1996 });
  assert.deepEqual({ state: mine.state, count: mine.count, note: mine.note }, { state: "ok", count: "1,996 of 2,000 words (your count)", note: null });
  assert.match(wordLine({ counted: 1915, total: 5585, estimate: true, limit: 2000, declared: 2100 }).note ?? "", /^100 over the limit by your count\./);
  // A page guide or no limit: no "of N words" at all.
  assert.equal(wordLine({ counted: 3900, total: 5200, leftOut: "equations", estimate: true, limit: null }).count, "About 3,900 words counted");
  assert.equal(wordLine({ counted: 900, total: 900, estimate: false, limit: null }).count, "900 words");
  // The minimum for a review is about the work as a whole, not what counts.
  assert.equal(wordLine({ counted: 90, total: 400, estimate: true, limit: 2000 }).state, "ok");
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

test("guide versions: one tile per component, the versions newest first, and a short name for each", () => {
  const old = { ...rubric("cs14", "Computer Science", "Internal Assessment (solution)", "internal_assessment"), key: "ib-dp-computer-science-ia-2014", sessionLabel: "first assessment 2014 (replaced by the guide for first assessment 2027)" };
  const fresh = { ...rubric("cs27", "Computer Science", "Internal Assessment (computational solution)", "internal_assessment"), key: "ib-dp-computer-science-ia-2027", sessionLabel: "first assessment 2027 (new guide: the computational solution)" };
  const bio = { ...rubric("b", "Biology", "Internal Assessment", "internal_assessment"), key: "ib-dp-biology-ia-2025" };
  assert.equal(rubricFamily(old), "ib-dp-computer-science-ia");
  assert.equal(rubricFamily(old), rubricFamily(fresh));
  // The server's own fields win over the key; a rubric with neither is its own family.
  assert.equal(rubricFamily({ id: "x", key: "a-2020", family: "f" }), "f");
  assert.equal(rubricFamily({ id: "x" }), "x");
  assert.equal(guideYear(fresh), 2027);
  assert.equal(guideYear({ id: "x", key: "a-2020", guideYear: 2031 }), 2031);
  assert.equal(guideYear({ id: "x", key: "ib-dp-tok-essay" }), null);
  assert.deepEqual(guideVersions([old, bio, fresh], old).map((r) => r.id), ["cs27", "cs14"]);
  assert.deepEqual(guideVersions([old, bio, fresh], bio).map((r) => r.id), ["b"]);
  // The picker shows the newest guide for a component; the version is chosen after.
  assert.deepEqual(newestVersions([old, bio, fresh]).map((r) => r.id), ["b", "cs27"]);
  assert.deepEqual(groupRubrics(newestVersions([old, bio, fresh]), "").flatMap((g) => g.rubrics.map((r) => r.id)), ["b", "cs27"]);
  assert.equal(versionName(fresh), "2027 guide");
  assert.equal(versionName({ id: "x", key: "ib-dp-tok-essay", sessionLabel: "first assessment 2022" }), "first assessment 2022");
  assert.equal(headingList(["Section A: Problem Specification (250 words)", "Section C: System Overview (0 words)", "Section D: Development", "Section E: Evaluation"]), "“Section A: Problem Specification”, “Section C: System Overview”, “Section D: Development”");
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
  assert.deepEqual(segs.map((s) => [s.letter, +s.start.toFixed(2), +s.end.toFixed(2), s.low, s.high, +s.mark.toFixed(2)]), [["A", 0.01, 0.24, 0.5, 1, 0.67], ["B", 0.26, 0.99, 0.5, 0.5, 0.5]]);
  assert.equal(ringSegments([{ letter: "A", maxMarks: 6, bandLow: 3, bandHigh: 6, mark: 5 }])[0].mark, 5 / 6);
  assert.deepEqual(ringSegments([]), []);
});

test("the draft switcher lists reviews in order, then drafts nothing has read, labelled by kind", () => {
  const pdf = { id: "f1", kind: "file" as const, number: 1, format: "pdf" };
  const text = { id: "t2", kind: "text" as const, number: 2 };
  const label = (e: ReturnType<typeof draftEntries>) => e.map((d) => [d.reviewId, d.draftId, d.label]);
  // A PDF just uploaded.
  assert.deepEqual(label(draftEntries([], [pdf])), [[null, "f1", "Draft 1 · PDF"]]);
  // Reviewed as a PDF, then "Edit as text": the text version is the next draft, not reviewed yet.
  const r1 = { id: "r1", draftId: "f1", draftKind: "file" as const, createdAt: "2026-11-20T10:00:00Z" };
  assert.deepEqual(label(draftEntries([r1], [text, pdf])), [["r1", "f1", "Draft 1 · PDF"], [null, "t2", "Draft 2 · Text"]]);
  // The text version reviewed twice (edited in between): each review is a draft the student sent.
  const r2 = { id: "r2", draftId: "t2", draftKind: "text" as const, createdAt: "2026-11-21T10:00:00Z" };
  const r3 = { id: "r3", draftId: "t2", draftKind: "text" as const, createdAt: "2026-11-22T10:00:00Z" };
  assert.deepEqual(label(draftEntries([r3, r1, r2], [text, pdf])), [["r1", "f1", "Draft 1 · PDF"], ["r2", "t2", "Draft 2 · Text"], ["r3", "t2", "Draft 3 · Text"]]);
  // A Word file: the original and the text version the server made from it.
  assert.deepEqual(label(draftEntries([], [{ id: "w1", kind: "file", number: 1, format: "docx" }, text])), [[null, "w1", "Draft 1 · Word"], [null, "t2", "Draft 2 · Text"]]);
  assert.equal(draftKindLabel("file", "doc"), "Word");
  assert.equal(draftKindLabel("file", "image"), "File");
  assert.equal(draftKindLabel(null), "Text");
});

test("the count follows the component's rules, and falls back when a rubric has none yet", () => {
  const prose = "The club secretary records every court booking by hand in a paper diary kept at the front desk. ".repeat(8);
  const html = `<h1>Development</h1><p>${prose}</p><table><tr><td><p>Task one</p></td><td><p>Meet the client</p></td></tr></table><p>total = total + used;</p><h1>Bibliography</h1><p>Lutz, M. (2013) Learning Python. Sebastopol: O'Reilly Media.</p><h1>Appendix A: Source code</h1><p>${prose}</p>`;
  const fallback = resolveWordCountRules(undefined, 2000);
  assert.deepEqual({ fallback: fallback.fallback, excludes: fallback.excludes, limit: fallback.limit }, { fallback: true, excludes: ["title_page", "contents", "bibliography", "appendices", "tables", "code"], limit: 2000 });
  const b = countWork({ html, file: true }, fallback);
  // The prose; the lone line before it reads as the work's title, which no board counts.
  assert.equal(b.counted, 8 * 18);
  assert.deepEqual(Object.keys(b.excluded).sort(), ["appendices", "bibliography", "code", "tables", "title_page"]);
  assert.equal(b.estimate, true);
  const rules = resolveWordCountRules({ limit: null, kind: "pages", excludes: ["headings", "bibliography", "appendices"], note: "A page guide." }, null);
  assert.deepEqual({ kind: rules.kind, limit: rules.limit, fallback: rules.fallback }, { kind: "pages", limit: null, fallback: false });
  // The editor's document counts the same way, exactly (no "about").
  const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: prose }] }, { type: "codeBlock", content: [{ type: "text", text: "x = 1" }] }] };
  assert.deepEqual({ counted: countWork({ doc }, fallback).counted, estimate: countWork({ doc }, fallback).estimate }, { counted: 8 * 18, estimate: false });
});

test("the predicted total: the estimate with a narrow likely range, never the band sums", () => {
  assert.equal(criterionMark({ bandLow: 3, bandHigh: 4, mark: 4 }), 4);
  assert.equal(criterionMark({ bandLow: 3, bandHigh: 4 }), 3, "old results: the midpoint rounded down");
  assert.deepEqual(likelyRange(16, 20), { low: 15, high: 17 });
  assert.deepEqual(likelyRange(23, 34), { low: 21, high: 25 });
  assert.deepEqual(likelyRange(13, 20, { low: 13, high: 18 }), { low: 13, high: 14 }, "never wider than the old span");
  const p = prediction({ marksEstimate: 16, marksLow: 15, marksHigh: 17 }, 20);
  assert.equal(estimateLabel(p), "16 of 20");
  assert.equal(likelyLabel(p), "likely 15–17");
  assert.equal(predictionSpoken(p), "Predicted 16 out of 20, likely 15 to 17");
  assert.deepEqual(predictionSpan(p), { fill: 80, low: 75, high: 85 });
  // A row from a server before the estimate: 20–26 of 34 becomes 23, likely 21–25.
  assert.deepEqual(prediction({ marksLow: 20, marksHigh: 26 }, 34), { estimate: 23, low: 21, high: 25, max: 34 });
  assert.equal(likelyLabel({ low: 5, high: 5 }), null);
});

test("an old 13–18 of 20 result reads as 13, likely 13–14, with each criterion's mark", () => {
  const old: MarkedResult = {
    ...SAMPLE_RESULT,
    overall: { marksLow: 13, marksHigh: 18, totalMarks: 20, gradeLow: "4", gradeHigh: "6", summary: "" },
    criteria: [[4, 3, 4], [4, 2, 3], [3, 2, 3], [3, 2, 3], [6, 4, 5]].map(([maxMarks, bandLow, bandHigh], i) => ({ ...SAMPLE_RESULT.criteria[0], letter: "ABCDE"[i], maxMarks, bandLow, bandHigh, mark: undefined })),
  };
  const r = withEstimate(old);
  assert.deepEqual(r.criteria.map((c) => c.mark), [3, 2, 2, 2, 4]);
  assert.deepEqual([r.overall.marksEstimate, r.overall.marksLow, r.overall.marksHigh, r.overall.gradeLow], [13, 13, 14, null]);
  assert.equal(withEstimate(SAMPLE_RESULT), SAMPLE_RESULT, "current results pass unchanged");
  assert.equal(withEstimate(null), null);
});
