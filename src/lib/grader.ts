/**
 * Coursework grader rules for the app, kept pure so they are tested: which
 * state the grader is in for this student, the plan/limit sentences, word
 * count against the limit, band labels, and evidence highlighting.
 *
 * PRESENTATION ONLY. Limits, plans and what counts are decided by the server
 * (goscribe/server lib/coursework/limits.ts); these read its answers.
 */
import type { GraderStatus, GradeResult, MarkedCriterion, ReviewStatus } from "./api/grader";
import { prediction } from "./coursework";

/** Server COURSEWORK_LIMIT_PREFIX: a refused review request starts with it. */
export const COURSEWORK_LIMIT_PREFIX = "Coursework review limit";

/** The Ultra upsell (founder copy). Only show it when `status.ultraAvailable`. */
export const ULTRA_UPSELL = "Unlimited reviews with Ultra — +$20/month";

/**
 * hidden: the server has no grader (or it failed to answer);
 * locked: the plan has no reviews (free, Starter);
 * limit: today's reviews are used up;
 * ready: a review can be requested.
 */
export type GraderGate = "hidden" | "locked" | "limit" | "ready";

export function graderGate(status: GraderStatus | false | null | undefined): GraderGate {
  if (!status) return "hidden";
  if (status.allowed) return "ready";
  return status.reason === "locked" ? "locked" : "limit";
}

/** The wall variant for `wall.shown {reason: 'grader'}`. */
export function graderWallVariant(gate: GraderGate): "locked" | "limit" | null {
  return gate === "locked" ? "locked" : gate === "limit" ? "limit" : null;
}

/** True for the server's plan-limit refusal of a review request. */
export function isGraderLimitError(message: string | null | undefined): boolean {
  return (message ?? "").startsWith(COURSEWORK_LIMIT_PREFIX);
}

/** "2 reviews a day", "Unlimited reviews", or null when the plan has none. */
export function reviewsPerDayLabel(perDay: number | null | undefined): string | null {
  if (perDay === undefined) return null;
  if (perDay === null) return "Unlimited reviews";
  if (perDay <= 0) return null;
  return `${perDay} ${perDay === 1 ? "review" : "reviews"} a day`;
}

/** "1 of 2 reviews left today", "Unlimited reviews", "No reviews left today". */
export function remainingLine(status: Pick<GraderStatus, "limit" | "remainingToday">): string {
  if (status.limit === null) return "Unlimited reviews";
  const left = Math.max(0, status.remainingToday ?? 0);
  if (left === 0) return "No reviews left today";
  return `${left} of ${status.limit} ${status.limit === 1 ? "review" : "reviews"} left today`;
}

/** "Back at midnight" style reset sentence in the student's own clock. */
export function resetLine(resetsAt: Date | string, locale = "en-GB", timeZone?: string): string {
  const d = new Date(resetsAt);
  if (Number.isNaN(d.getTime())) return "You can review again tomorrow.";
  try {
    const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) });
    return `You can review again tomorrow (from ${time}).`;
  } catch {
    return "You can review again tomorrow.";
  }
}

export interface WordCountState {
  words: number;
  limit: number | null;
  /** "3,850 / 4,000 words", or "3,850 words" without a limit. */
  label: string;
  /** over: past the limit (examiners stop reading there); near: within 5%. */
  tone: "ok" | "near" | "over";
  /** Words past the limit (0 when within). */
  over: number;
}

export function wordCountState(words: number, limit: number | null | undefined, locale = "en-GB"): WordCountState {
  const fmt = (n: number) => n.toLocaleString(locale);
  const lim = limit ?? null;
  if (lim === null) return { words, limit: null, label: `${fmt(words)} words`, tone: "ok", over: 0 };
  const over = Math.max(0, words - lim);
  return { words, limit: lim, label: `${fmt(words)} / ${fmt(lim)} words`, tone: over > 0 ? "over" : words >= lim * 0.95 ? "near" : "ok", over };
}

/** "4–5 / 6" for a band (an en dash between, a single number when equal). */
export function bandLabel(low: number, high: number, max: number): string {
  return `${low === high ? low : `${low}–${high}`} / ${max}`;
}

/** The predicted total line: "21 / 30 (likely 19–23)" plus the predicted grade when the rubric has boundaries. */
export function overallLabel(result: GradeResult): string | null {
  if (result.mode !== "marked") return null;
  const o = result.overall;
  const p = prediction(o, o.totalMarks);
  const marks = `${p.estimate} / ${p.max}${p.low !== p.high ? ` (likely ${p.low}–${p.high})` : ""}`;
  const grade = o.gradeEstimate ?? (o.gradeLow && o.gradeHigh ? (o.gradeLow === o.gradeHigh ? o.gradeLow : `${o.gradeLow}–${o.gradeHigh}`) : null);
  return grade ? `${marks} · ${grade}` : marks;
}

/** Still being worked on (poll). */
export function isPending(status: ReviewStatus): boolean {
  return status === "queued" || status === "grading";
}

/** Poll delay for a pending review: quick at first, then every 5 s. */
export function pollDelayMs(elapsedMs: number): number {
  return elapsedMs < 30_000 ? 3_000 : 5_000;
}

export interface HighlightSpan {
  start: number;
  end: number;
  /** Criterion letter the quote is evidence for. */
  letter: string;
}

/**
 * Evidence spans for highlighting the reviewed snapshot, sorted and without
 * overlaps (the earlier quote wins), dropping any span outside the text.
 */
export function highlightSpans(criteria: Array<Pick<MarkedCriterion, "letter" | "evidence">>, textLength: number): HighlightSpan[] {
  const spans = criteria
    .flatMap((c) => c.evidence.map((e) => ({ start: e.start, end: e.end, letter: c.letter })))
    .filter((s) => Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && s.end <= textLength)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: HighlightSpan[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s.start < last.end) continue;
    out.push(s);
  }
  return out;
}

/**
 * Where a review's quote is in the CURRENT editor text, which may have
 * changed since the review (the snapshot offsets then no longer line up).
 * Exact match first, then whitespace-insensitive; null when the student has
 * since changed that passage.
 */
export function findQuoteInText(quote: string, text: string, from = 0): { start: number; end: number } | null {
  const exact = text.indexOf(quote, from);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const words = quote.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length || !words[0]) return null;
  const re = new RegExp(words.join("\\s+"), "g");
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}
