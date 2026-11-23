/**
 * The coursework grader's words and sums, kept pure so they can be tested:
 * how a mark band is written and drawn, how two drafts compare, what the
 * daily allowance says, how many words a piece has, which citation issues
 * there are, and where a quoted passage sits in the student's text.
 *
 * PRESENTATION ONLY. Nothing here decides a mark, an allowance or a price.
 */
import type { CitationsResult, GradeResult, MarkedResult, ResultCriterion, ReviewAllowance, RubricInfo } from "./api/coursework";

/** Ultra as it is offered: null hides every mention of it. */
export interface UltraOffer {
  priceAboveProDollars: number;
}

/**
 * "Edit as text": making an editable text draft from an uploaded PDF or Word
 * file. Off for now: an upload is previewed and graded as it is (the server
 * endpoint and existing text drafts keep working). Turn it on to bring the
 * action back in the document's toolbar.
 */
export const EDIT_UPLOADS_AS_TEXT = false;

/** Shortest work worth reviewing (server MIN_WORDS). */
export const MIN_WORDS = 150;

/* ---------- Bands ---------- */

/** "4–5", or "5" when the band is a single mark. Never a bare point estimate of a range. */
export function formatBand(low: number, high: number): string {
  return low === high ? String(low) : `${low}–${high}`;
}

/** "4–5 of 6". */
export function bandLabel(low: number, high: number, max: number): string {
  return `${formatBand(low, high)} of ${max}`;
}

/** For a screen reader: "4 to 5 marks out of 6". */
export function bandSpoken(low: number, high: number, max: number): string {
  const range = low === high ? `${low} ${low === 1 ? "mark" : "marks"}` : `${low} to ${high} marks`;
  return `${range} out of ${max}`;
}

/** Above this many marks a track is one bar, not one cell per mark. */
export const MAX_TRACK_CELLS = 12;

/**
 * A track with one cell per mark: cell `i` (0-based) is mark `i + 1`, filled
 * when it is inside the band. A band of 0–0 fills nothing.
 */
export function bandCells(low: number, high: number, max: number): boolean[] {
  return Array.from({ length: Math.max(0, max) }, (_, i) => i + 1 >= Math.max(1, low) && i + 1 <= high && high > 0);
}

/** A long scale as one bar: where the band starts and ends, in percent of the track. */
export function bandSpan(low: number, high: number, max: number): { start: number; end: number } {
  if (max <= 0) return { start: 0, end: 0 };
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  // The band covers marks low..high: from the left edge of `low` to the right edge of `high`.
  const start = clamp(((Math.max(1, low) - 1) / max) * 100);
  const end = high <= 0 ? 0 : clamp((high / max) * 100);
  return { start: Math.min(start, end), end };
}

export interface OverallLike {
  /** The predicted total (absent from servers before the estimate). */
  marksEstimate?: number;
  /** The narrow likely range around it (the band sums on servers before the estimate). */
  marksLow: number;
  marksHigh: number;
  totalMarks: number;
  gradeEstimate?: string | null;
  gradeLow: string | null;
  gradeHigh: string | null;
}

/* ---------- The predicted total (server lib/coursework/estimate.ts) ---------- */

/**
 * A criterion's best-estimate mark: the server's `mark` inside the band, or
 * undefined for results from before it existed (their band is shown, no mark
 * is invented; a one-mark band is its mark). Mirrors the server's estimate.ts.
 */
export function criterionMark(c: { bandLow: number; bandHigh: number; mark?: number | null }): number | undefined {
  const low = Math.min(c.bandLow, c.bandHigh);
  const high = Math.max(c.bandLow, c.bandHigh);
  if (typeof c.mark === "number" && Number.isFinite(c.mark)) return Math.min(high, Math.max(low, Math.round(c.mark)));
  return low === high ? low : undefined;
}

/** Where a criterion sits for totals, drawing and comparing: its mark, or the band's exact midpoint (3–4 → 3.5). */
export function criterionPoint(c: { bandLow: number; bandHigh: number; mark?: number | null }): number {
  return criterionMark(c) ?? (Math.min(c.bandLow, c.bandHigh) + Math.max(c.bandLow, c.bandHigh)) / 2;
}

/** A total is rounded once, half up (15.5 → 16): rounding each band's midpoint down would put every two-mark band at its floor. */
const roundTotal = (n: number) => Math.floor(n + 0.5);

/**
 * The likely range around a predicted total: ±1 for 24 marks or fewer, ±2
 * above, inside 0..max and never wider than the sum of the bands. The server
 * decides this (estimate.ts likelyRange, with its reasoning); the app only
 * recomputes it for results from a server that predates it.
 */
export function likelyRange(estimate: number, totalMarks: number, span?: { low: number; high: number }): { low: number; high: number } {
  const max = Math.max(0, totalMarks);
  const margin = max <= 24 ? 1 : 2;
  const floor = Math.max(0, span ? span.low : 0);
  const ceil = Math.min(max, span ? span.high : max);
  const at = Math.min(ceil, Math.max(floor, estimate));
  return { low: Math.max(floor, at - margin), high: Math.min(ceil, at + margin) };
}

export interface Prediction {
  estimate: number;
  low: number;
  high: number;
  max: number;
}

/**
 * The predicted total of a review row or result overall. With
 * `marksEstimate` (current servers) that and the narrow range as sent; from
 * an older server, whose `marksLow`..`marksHigh` are the band sums, their
 * midpoint (rounded half up) and the narrow range inside them.
 */
export function prediction(o: { marksEstimate?: number | null; marksLow: number; marksHigh: number }, max: number): Prediction {
  if (typeof o.marksEstimate === "number") return { estimate: o.marksEstimate, low: Math.min(o.marksLow, o.marksEstimate), high: Math.max(o.marksHigh, o.marksEstimate), max };
  const estimate = roundTotal((o.marksLow + o.marksHigh) / 2);
  return { estimate, ...likelyRange(estimate, max, { low: o.marksLow, high: o.marksHigh }), max };
}

/**
 * A result as the screens read it: the overall estimate with its narrow
 * range. Results from a server before the estimate get it from their
 * criteria (band midpoints summed, the total rounded half up, as the server
 * does); their criteria keep their bands with no mark, and their grades
 * (read off the band sums) are dropped. Current results pass unchanged.
 */
export function withEstimate<T extends GradeResult | null | undefined>(result: T): T {
  if (!result || result.mode !== "marked") return result;
  const r = result as MarkedResult;
  if (typeof r.overall.marksEstimate === "number") return result;
  const criteria = r.criteria;
  const estimate = roundTotal(criteria.reduce((n, c) => n + criterionPoint(c), 0));
  const span = { low: criteria.reduce((n, c) => n + Math.min(c.bandLow, c.bandHigh), 0), high: criteria.reduce((n, c) => n + Math.max(c.bandLow, c.bandHigh), 0) };
  const { low, high } = likelyRange(estimate, r.overall.totalMarks, span);
  return { ...r, overall: { ...r.overall, marksEstimate: estimate, marksLow: low, marksHigh: high, gradeEstimate: null, gradeLow: null, gradeHigh: null } } as T;
}

/** "16 of 20", the predicted total as written beside it. */
export function estimateLabel(p: Pick<Prediction, "estimate" | "max">): string {
  return `${p.estimate} of ${p.max}`;
}

/** "likely 15–17", the range under the estimate; null when it is the estimate itself. */
export function likelyLabel(p: Pick<Prediction, "low" | "high">): string | null {
  return p.low === p.high ? null : `likely ${p.low}–${p.high}`;
}

/** For a screen reader: "Predicted 16 out of 20, likely 15 to 17". */
export function predictionSpoken(p: Prediction): string {
  const base = `Predicted ${p.estimate} out of ${p.max}`;
  return p.low === p.high ? base : `${base}, likely ${p.low} to ${p.high}`;
}

/** The predicted track: filled to the estimate, with the likely range drawn faintly around it (percent of the track). */
export function predictionSpan(p: Prediction): { fill: number; low: number; high: number } {
  if (p.max <= 0) return { fill: 0, low: 0, high: 0 };
  const pct = (n: number) => Math.min(100, Math.max(0, (n / p.max) * 100));
  return { fill: pct(p.estimate), low: pct(p.low), high: pct(p.high) };
}

/** "5–6", "6", or null when the rubric has no grade boundaries. */
export function gradeRange(o: Pick<OverallLike, "gradeLow" | "gradeHigh">): string | null {
  if (!o.gradeLow && !o.gradeHigh) return null;
  const low = o.gradeLow ?? o.gradeHigh!;
  const high = o.gradeHigh ?? o.gradeLow!;
  return low === high ? low : `${low}–${high}`;
}

export type MarksRange = Pick<OverallLike, "marksLow" | "marksHigh" | "totalMarks">;

export type ResultMood = "strong" | "okay" | "rough";

/** How the cat reacts: by where the predicted total sits. Encouraging at the low end, never mocking. */
export function resultMood(o: Pick<OverallLike, "marksEstimate" | "marksLow" | "marksHigh" | "totalMarks">): ResultMood {
  if (o.totalMarks <= 0) return "okay";
  const mid = prediction(o, o.totalMarks).estimate / o.totalMarks;
  return mid >= 0.75 ? "strong" : mid >= 0.5 ? "okay" : "rough";
}

/** A feedback-only review carries no bands. */
export function hasMarks(result: GradeResult | null | undefined): result is MarkedResult {
  return !!result && result.mode === "marked";
}



/** What Scribe says about a criterion: the band's justification, or the comment of a feedback-only review. */
export function criterionComment(c: ResultCriterion): string {
  return "justification" in c ? c.justification : c.assessment;
}

/** What to do next on a criterion: "to move up a band", or "to improve" without marks. */
export function criterionNext(c: ResultCriterion): string {
  return "toMoveUp" in c ? c.toMoveUp : c.toImprove;
}

/* ---------- Draft comparison ---------- */

export type Movement = "up" | "down" | "same";

export interface CriterionMove {
  letter: string;
  name: string;
  maxMarks: number;
  /** The band, the best-estimate mark inside it (absent on older results), and where it sits (the mark, else the band's midpoint). */
  from: { low: number; high: number; mark?: number; point: number } | null;
  to: { low: number; high: number; mark?: number; point: number };
  move: Movement | "new";
}

export interface DraftComparison {
  rows: CriterionMove[];
  up: number;
  down: number;
  same: number;
  overall: { from: Prediction; to: Prediction; move: Movement };
}

function movement(from: number, to: number): Movement {
  return to > from ? "up" : to < from ? "down" : "same";
}

/**
 * Which criteria moved between two marked drafts, by each criterion's
 * best-estimate mark, or its band's middle on older results (4 → 5 is up;
 * 4 → 4 is the same), and the predicted
 * total. Null when either draft has no marks (a feedback-only review).
 */
export function compareDrafts(prevResult: GradeResult | null | undefined, nextResult: GradeResult | null | undefined): DraftComparison | null {
  const prev = withEstimate(prevResult);
  const next = withEstimate(nextResult);
  if (!hasMarks(prev) || !hasMarks(next)) return null;
  const before = new Map(prev.criteria.map((c) => [c.letter, c]));
  const rows: CriterionMove[] = next.criteria.map((c) => {
    const b = before.get(c.letter);
    const to = { low: c.bandLow, high: c.bandHigh, mark: criterionMark(c), point: criterionPoint(c) };
    if (!b) return { letter: c.letter, name: c.name, maxMarks: c.maxMarks, from: null, to, move: "new" };
    const from = { low: b.bandLow, high: b.bandHigh, mark: criterionMark(b), point: criterionPoint(b) };
    return { letter: c.letter, name: c.name, maxMarks: c.maxMarks, from, to, move: movement(from.point, to.point) };
  });
  const count = (m: Movement) => rows.filter((r) => r.move === m).length;
  const from = prediction(prev.overall, prev.overall.totalMarks);
  const to = prediction(next.overall, next.overall.totalMarks);
  return {
    rows,
    up: count("up"),
    down: count("down"),
    same: count("same"),
    overall: { from, to, move: movement(from.estimate, to.estimate) },
  };
}

/** "2 criteria moved up, 1 moved down", "Nothing moved yet". */
export function comparisonHeadline(c: Pick<DraftComparison, "up" | "down">): string {
  const part = (n: number, dir: string) => `${n} ${n === 1 ? "criterion" : "criteria"} moved ${dir}`;
  if (c.up && c.down) return `${part(c.up, "up")}, ${c.down} moved down`;
  if (c.up) return part(c.up, "up");
  if (c.down) return part(c.down, "down");
  return "No criterion changed band";
}

/* ---------- The daily allowance ---------- */

/** "in 5 h 12 min", "in 12 min", "in under a minute". */
export function timeUntil(target: string | Date, now: Date): string {
  const ms = new Date(target).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 60_000) return "in under a minute";
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `in ${m} min`;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}

export type AllowanceState = "locked" | "unlimited" | "left" | "limit";

export interface AllowanceCopy {
  state: AllowanceState;
  /** The quiet line beside the button: "1 of 2 reviews left today". */
  line: string;
  /** Limit reached: when the next review unlocks. */
  resets: string | null;
  /** Limit reached and Ultra is sold: "Unlimited reviews with Ultra — +$20/month". */
  upsell: string | null;
}

export function ultraPitch(ultra: UltraOffer | null | undefined): string | null {
  return ultra ? `Unlimited reviews with Ultra — +$${ultra.priceAboveProDollars}/month` : null;
}

/**
 * What the student reads about today's reviews. Ultra is mentioned only when
 * it is configured and only at the limit; a limit without Ultra just says when
 * reviews come back.
 */
export function allowanceCopy(a: ReviewAllowance, ultra: UltraOffer | null | undefined, now: Date): AllowanceCopy {
  if (a.reason === "locked" || (a.limit !== null && a.limit <= 0)) {
    return { state: "locked", line: "Coursework reviews are part of Pro", resets: null, upsell: null };
  }
  if (a.limit === null && a.allowed) return { state: "unlimited", line: "Unlimited reviews", resets: null, upsell: null };
  const left = a.remainingToday ?? 0;
  if (a.allowed && left > 0) {
    return { state: "left", line: `${left} of ${a.limit} ${a.limit === 1 ? "review" : "reviews"} left today`, resets: null, upsell: null };
  }
  const resets = `Your next review unlocks at midnight, ${timeUntil(a.resetsAt, now)}.`;
  return {
    state: "limit",
    line: a.limit === null ? "That's a lot of reviews for one day" : `You've used today's ${a.limit} ${a.limit === 1 ? "review" : "reviews"}`,
    resets,
    // Someone already on Ultra (the hidden cap) is never sold Ultra.
    upsell: a.tier === "ultra" ? null : ultraPitch(ultra),
  };
}

/* ---------- Words ---------- */

export function countWords(text: string): number {
  const m = text.trim().match(/[^\s]+/g);
  return m ? m.length : 0;
}

export type WordState = "empty" | "short" | "ok" | "over";

export interface WordStatus {
  state: WordState;
  /** "About 2,140 words counted of 2,000", "2,184 of 2,200 words", "2,184 words". */
  count: string;
  /** A calm line when short or over; null otherwise. */
  note: string | null;
  /** "3,445 not counted (tables, code, appendices, bibliography)"; null when everything counts. */
  detail: string | null;
}

const n = (v: number) => v.toLocaleString("en-GB");

export interface WordLineInput {
  /** Words that count toward the limit under the component's rules. */
  counted: number;
  /** Every word in the work (what the minimum for a review is checked against). */
  total: number;
  /** What was left out, already worded: "tables, code, appendices". */
  leftOut?: string;
  /** From an uploaded file: the count is an estimate and is said as one. */
  estimate: boolean;
  /** The word limit; null for a page guide or no limit (then no "of N" is shown at all). */
  limit: number | null;
  /** The student's own count ("My word count is ___"): it decides over/under when given. */
  declared?: number | null;
}

/**
 * The word count line. Counting from a file is an estimate, so being over
 * the limit is never stated as fact: "About 2,140 words counted of 2,000",
 * with the student's own count taking over when they give it. The whole
 * work is reviewed either way.
 */
export function wordLine(i: WordLineInput): WordStatus {
  const about = i.estimate ? "About " : "";
  const own = typeof i.declared === "number" && i.declared > 0 ? i.declared : null;
  const count =
    own !== null
      ? i.limit
        ? `${n(own)} of ${n(i.limit)} words (your count)`
        : `${n(own)} words (your count)`
      : i.limit
        ? `${about}${n(i.counted)} words counted of ${n(i.limit)}`
        : i.total - i.counted > 0
          ? `${about}${n(i.counted)} words counted`
          : `${n(i.counted)} ${i.counted === 1 ? "word" : "words"}`;
  const notCounted = i.total - i.counted;
  const detail = notCounted > 0 ? `${n(notCounted)} not counted${i.leftOut ? ` (${i.leftOut})` : ""}` : null;
  if (i.total === 0) return { state: "empty", count, note: null, detail: null };
  if (i.total < MIN_WORDS) {
    return { state: "short", count, note: `Add at least ${MIN_WORDS} words for a review. ${n(MIN_WORDS - i.total)} to go.`, detail };
  }
  const used = own ?? i.counted;
  if (i.limit && used > i.limit) {
    const over = used - i.limit;
    const note =
      own !== null
        ? `${n(over)} over the limit by your count. Examiners are not required to read past ${n(i.limit)} words. Your whole work is still reviewed.`
        : i.estimate
          ? `About ${n(Math.max(10, Math.round(over / 10) * 10))} over the limit by Scribe's count, which is an estimate from your file. Check it against your own word count. Your whole work is still reviewed.`
          : `${n(over)} over the limit. Examiners are not required to read past ${n(i.limit)} words. Your whole work is still reviewed.`;
    return { state: "over", count, note, detail };
  }
  return { state: "ok", count, note: null, detail };
}

/** A plain count with nothing left out (pasted text before a component is chosen, older servers). */
export function wordStatus(words: number, limit: number | null): WordStatus {
  const s = wordLine({ counted: words, total: words, estimate: false, limit });
  return limit ? { ...s, count: `${n(words)} of ${n(limit)} words` } : s;
}

/* ---------- Rubrics ---------- */

/** "Biology IA", "Extended Essay", "TOK essay", "English A HL essay". */
export function componentTitle(r: Pick<RubricInfo, "subject" | "component" | "componentKind">): string {
  if (r.componentKind === "internal_assessment") return `${r.subject} IA`;
  if (r.componentKind === "nea") return `${r.subject} NEA`;
  // A subject's own written piece ("English A" + "HL essay"); the EE and TOK belong to no one subject.
  if (r.componentKind === "coursework" && !/^all subjects$/i.test(r.subject)) return `${r.subject} ${r.component}`;
  return r.component;
}

/** The quiet rubric line: "IB Biology IA · first assessment 2025". */
export function rubricLine(r: Pick<RubricInfo, "board" | "subject" | "component" | "componentKind" | "sessionLabel">): string {
  const short = r.componentKind === "extended_essay" ? "EE" : componentTitle(r);
  return `${r.board} ${short} · ${r.sessionLabel}`;
}

/** What the subject-colour rules read to pick the family for a component. */
export function familyText(r: Pick<RubricInfo, "subject" | "componentKind">): string {
  if (r.componentKind === "tok_essay" || r.componentKind === "tok_exhibition") return "Theory of Knowledge";
  if (r.componentKind === "extended_essay") return "Extended Essay writing";
  return r.subject;
}

/* ---------- Guide versions of one component ---------- */

type Versioned = Pick<RubricInfo, "id"> & { key?: string; family?: string; guideYear?: number | null };

/** Rubrics of one component share a family: the server's, else the key without its year ("…-ia-2027" → "…-ia"). */
export function rubricFamily(r: Versioned): string {
  return r.family ?? (r.key ? r.key.replace(/-(?:19|20)\d{2}$/, "") : r.id);
}

/** The guide's first-assessment year: the server's, else from the key. */
export function guideYear(r: Versioned): number | null {
  if (typeof r.guideYear === "number") return r.guideYear;
  const m = r.key ? /-((?:19|20)\d{2})$/.exec(r.key) : null;
  return m ? Number(m[1]) : null;
}

/** Every guide version of `rubric`'s component (itself included), newest guide first. */
export function guideVersions<R extends Versioned>(rubrics: R[], rubric: R): R[] {
  const family = rubricFamily(rubric);
  return rubrics.filter((r) => rubricFamily(r) === family).sort((a, b) => (guideYear(b) ?? 0) - (guideYear(a) ?? 0));
}

/** One rubric per component for the picker: the newest guide stands for its versions (the version is chosen after). */
export function newestVersions<R extends Versioned>(rubrics: R[]): R[] {
  const best = new Map<string, R>();
  for (const r of rubrics) {
    const have = best.get(rubricFamily(r));
    if (!have || (guideYear(r) ?? 0) > (guideYear(have) ?? 0)) best.set(rubricFamily(r), r);
  }
  return rubrics.filter((r) => best.get(rubricFamily(r)) === r);
}

/** "2027 guide" for a version's button; its session label when the key has no year. */
export function versionName(r: Versioned & Pick<RubricInfo, "sessionLabel">): string {
  const y = guideYear(r);
  return y ? `${y} guide` : r.sessionLabel;
}

/** Up to three of the work's headings, quoted, without a trailing "(250 words)". */
export function headingList(headings: string[]): string {
  return headings
    .slice(0, 3)
    .map((h) => `“${h.replace(/\s*\(\s*[\d,.]+\s*words?\s*\)\s*$/i, "").trim() || h}”`)
    .join(", ");
}

export interface RubricGroup<R> {
  id: "yours" | "core" | "ia";
  title: string;
  rubrics: R[];
}

/** The picker's groups: the student's own first, then the core, then internal assessments A–Z. A search flattens to what matches. */
export function groupRubrics<R extends Pick<RubricInfo, "id" | "subject" | "component" | "componentKind" | "board" | "qualification"> & { suggested?: boolean }>(
  rubrics: R[],
  query: string,
): RubricGroup<R>[] {
  const q = query.trim().toLowerCase();
  const match = (r: R) =>
    !q || `${componentTitle(r)} ${r.subject} ${r.component} ${r.board} ${r.qualification} internal assessment`.toLowerCase().includes(q);
  const byTitle = (a: R, b: R) => componentTitle(a).localeCompare(componentTitle(b));
  const core = rubrics.filter((r) => r.componentKind !== "internal_assessment" && r.componentKind !== "nea" && r.componentKind !== "coursework");
  const rest = rubrics.filter((r) => !core.includes(r));
  // A student's own subjects come first; the core (EE, TOK) is everyone's, so it never needs suggesting.
  const yours = q ? [] : rest.filter((r) => r.suggested).sort(byTitle);
  const mine = new Set(yours.map((r) => r.id));
  const groups: RubricGroup<R>[] = [
    { id: "yours", title: "For your subjects", rubrics: yours },
    { id: "core", title: "Core", rubrics: core.filter(match) },
    { id: "ia", title: q ? "Internal assessments" : yours.length ? "Other internal assessments" : "Internal assessments", rubrics: rest.filter((r) => match(r) && !mine.has(r.id)).sort(byTitle) },
  ];
  return groups.filter((g) => g.rubrics.length > 0);
}

/* ---------- Citations ---------- */

export type CitationIssueKind = "style" | "cited_not_listed" | "listed_not_cited" | "uncited" | "entry" | "not_found";

export interface CitationItem {
  id: string;
  kind: CitationIssueKind;
  /** What this kind of issue is, in a few words: the group's label. */
  label: string;
  /** The student's own words the issue is about (a sentence, a citation, a reference entry), when there are some. */
  quote: string | null;
  /** What is wrong. */
  problem: string;
  /** How to fix it. */
  fix: string;
  /** The correct layout of ONE reference entry: formatting only, never the student's writing. */
  format: string | null;
}

const PART: Record<string, string> = {
  author: "author",
  title: "title",
  date: "date",
  publisher_or_site: "publisher or site",
  url_or_doi: "URL or DOI",
  access_date: "access date",
  page_numbers: "page numbers",
  edition_or_volume: "edition or volume",
};

const CLAIM: Record<string, string> = { quotation: "Quotation", statistic: "Statistic", date: "Date", claim: "Claim" };

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Every citation issue as one flat list, in the order a student would fix
 * them. A source that could not be looked up is "couldn't find this source":
 * a broken link or a typo is far more likely than anything else.
 */
export function citationItems(c: CitationsResult | null | undefined): CitationItem[] {
  if (!c) return [];
  const out: CitationItem[] = [];
  c.inconsistencies.forEach((text, i) =>
    out.push({ id: `style-${i}`, kind: "style", label: "Style", quote: null, problem: text, fix: c.style !== "None" && c.style !== "Unknown" && c.style !== "Other" ? `Use ${c.style} throughout.` : "Pick one referencing style and use it throughout.", format: null }),
  );
  c.citedNotListed.forEach((x, i) =>
    out.push({ id: `cnl-${i}`, kind: "cited_not_listed", label: "Cited, not in your bibliography", quote: x.text, problem: "Cited in your text but missing from the bibliography.", fix: x.fix, format: null }),
  );
  c.uncitedClaims.forEach((x, i) =>
    out.push({ id: `claim-${i}`, kind: "uncited", label: `${CLAIM[x.kind] ?? "Claim"} with no citation`, quote: x.sentence, problem: `${CLAIM[x.kind] ?? "Claim"} with no source given.`, fix: x.fix, format: null }),
  );
  c.listedNotCited.forEach((x, i) =>
    out.push({ id: `lnc-${i}`, kind: "listed_not_cited", label: "In your bibliography, never cited", quote: x.text, problem: "Listed in the bibliography but never cited in your text.", fix: x.fix, format: null }),
  );
  for (const e of c.entries) {
    if (e.missing.length > 0) {
      out.push({
        id: `entry-${e.index}`,
        kind: "entry",
        label: "Reference missing parts",
        quote: e.raw,
        problem: `This reference is missing its ${list(e.missing.map((m) => PART[m] ?? m))}.`,
        fix: "Add the missing parts from the source itself.",
        format: e.correctedFormat,
      });
    }
    if (e.lookup?.status === "not_found") {
      out.push({
        id: `lookup-${e.index}`,
        kind: "not_found",
        label: "Couldn't find this source",
        quote: e.raw,
        problem: `Scribe couldn't find this source at its ${e.lookup.kind === "doi" ? "DOI" : "link"}.`,
        fix: `Check the ${e.lookup.kind === "doi" ? "DOI" : "link"} for a typo and that it opens for you.`,
        format: null,
      });
    }
  }
  return out;
}

/** "3 issues to fix", "1 issue to fix", "No issues found". */
export function citationHeadline(count: number): string {
  if (count <= 0) return "No issues found";
  return `${count} ${count === 1 ? "issue" : "issues"} to fix`;
}

import { findQuote } from "./quote-match";

export { findQuote, quoteChanged, type TextRange } from "./quote-match";

/* ---------- Feedback anchors ---------- */

export interface FeedbackAnchor {
  /** Stable id: "A-0" (criterion A's first quote), "cite-claim-1". */
  id: string;
  quote: string;
  /** For a file draft: the 1-based page the server found the quote on, when it said. */
  page?: number;
  /** The feedback item it opens: a criterion letter or a citation item id. */
  target: { kind: "criterion"; letter: string } | { kind: "citation"; id: string };
}

/** Every passage the feedback quotes, so the document can mark it and the two can point at each other. */
export function feedbackAnchors(result: GradeResult | null | undefined, citations: CitationsResult | null | undefined): FeedbackAnchor[] {
  const anchors: FeedbackAnchor[] = [];
  for (const c of result?.criteria ?? []) {
    c.evidence.forEach((e, i) => {
      const page = (e as { page?: unknown }).page;
      anchors.push({ id: `${c.letter}-${i}`, quote: e.quote, ...(typeof page === "number" && page >= 1 ? { page } : {}), target: { kind: "criterion", letter: c.letter } });
    });
  }
  for (const item of citationItems(citations)) {
    if (item.quote && (item.kind === "uncited" || item.kind === "cited_not_listed")) {
      anchors.push({ id: `cite-${item.id}`, quote: item.quote, target: { kind: "citation", id: item.id } });
    }
  }
  return anchors;
}

/** The criterion a fix is about, by its letter. */
export function criterionFor(result: GradeResult, letter: string): ResultCriterion | undefined {
  return result.criteria.find((c) => c.letter.toUpperCase() === letter.trim().toUpperCase());
}

/** "Draft 2". */
export function draftLabel(n: number): string {
  return `Draft ${n}`;
}

/* ---------- Where a passage is: its section, for the location chips ---------- */

interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
}

function nodeText(n: DocNode): string {
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(nodeText).join(n.type === "paragraph" || n.type === "heading" ? "" : " ");
}

/**
 * The section each quoted passage sits in: the nearest heading above it in
 * the document ("Method", "Conclusion"), or "Paragraph 3" in a document with
 * no headings. A passage that is no longer in the text has no entry. There
 * are no fixed pages in an editor, so a section is the honest place name.
 */
export function locateAnchors(doc: unknown, anchors: Array<{ id: string; quote: string }>): Map<string, string> {
  const out = new Map<string, string>();
  const blocks = ((doc as DocNode | null)?.content ?? []) as DocNode[];
  let heading: string | null = null;
  let paragraph = 0;
  for (const block of blocks) {
    const text = nodeText(block).trim();
    if (block.type === "heading") {
      if (text) heading = text;
      continue;
    }
    if (!text) continue;
    paragraph += 1;
    for (const a of anchors) {
      if (out.has(a.id)) continue;
      if (findQuote(text, a.quote).length > 0) out.set(a.id, heading ? (heading.length > 28 ? `${heading.slice(0, 27).trimEnd()}…` : heading) : `Paragraph ${paragraph}`);
    }
  }
  return out;
}

/* ---------- The ring: one arc per criterion ---------- */

export interface RingSegment {
  letter: string;
  /** Where the arc starts and ends, as fractions of the circle (0–1), with a gap between arcs. */
  start: number;
  end: number;
  /** How far along the arc the band's low and high marks reach (0–1). */
  low: number;
  high: number;
  /** How far the best-estimate mark reaches (0–1); the band's midpoint on older results. */
  mark: number;
}

/** Each criterion gets a share of the circle in proportion to its marks; its band is drawn along its arc. */
export function ringSegments(criteria: Array<{ letter: string; maxMarks: number; bandLow: number; bandHigh: number; mark?: number | null }>, gap = 0.018): RingSegment[] {
  const total = criteria.reduce((n, c) => n + Math.max(0, c.maxMarks), 0);
  if (total <= 0) return [];
  let at = 0;
  const g = criteria.length > 1 ? gap : 0;
  return criteria.map((c) => {
    const share = c.maxMarks / total;
    const seg = { letter: c.letter, start: at + g / 2, end: at + share - g / 2, low: c.maxMarks > 0 ? c.bandLow / c.maxMarks : 0, high: c.maxMarks > 0 ? c.bandHigh / c.maxMarks : 0, mark: c.maxMarks > 0 ? criterionPoint(c) / c.maxMarks : 0 };
    at += share;
    return seg;
  });
}

/* ---------- Draft kinds ---------- */

/** "PDF", "Word", "File", or "Text": what a draft is, for the draft switcher ("Draft 1 · PDF"). */
export function draftKindLabel(kind: "file" | "text" | null | undefined, format?: string | null): string {
  if (kind !== "file") return "Text";
  if (format === "pdf") return "PDF";
  if (format === "docx" || format === "doc") return "Word";
  return "File";
}

export interface DraftEntry {
  /** The review this entry shows, or null for a draft no review has read yet. */
  reviewId: string | null;
  /** The draft on the document side. */
  draftId: string | null;
  kind: "file" | "text";
  /** Its place in the student's history, 1-based: every review is a draft they sent, in order. */
  position: number;
  /** "Draft 1 · PDF". */
  label: string;
}

/**
 * The draft switcher: every review in the order it was asked for (labelled by
 * what it read: the PDF as uploaded, or text), then each draft that no review
 * has read yet (a file just uploaded, the text version made from it). The
 * numbering is the student's own history ("Draft 1 · PDF", "Draft 2 · Text"),
 * so a text draft reviewed again after edits is the next draft.
 */
export function draftEntries(
  reviews: Array<{ id: string; draftId?: string | null; draftKind?: "file" | "text" | null; createdAt: Date | string }>,
  drafts: Array<{ id: string; kind: "file" | "text"; number: number; format?: string | null }>,
): DraftEntry[] {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const out: DraftEntry[] = [];
  const add = (reviewId: string | null, draftId: string | null, kind: "file" | "text", format?: string | null) => {
    const position = out.length + 1;
    out.push({ reviewId, draftId, kind, position, label: `Draft ${position} · ${draftKindLabel(kind, format)}` });
  };
  const reviewed = new Set<string>();
  for (const r of [...reviews].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    const d = r.draftId ? byId.get(r.draftId) : undefined;
    if (r.draftId) reviewed.add(r.draftId);
    add(r.id, r.draftId ?? null, r.draftKind ?? d?.kind ?? "text", d?.format);
  }
  for (const d of [...drafts].sort((a, b) => a.number - b.number)) {
    if (!reviewed.has(d.id)) add(null, d.id, d.kind, d.format);
  }
  return out;
}
