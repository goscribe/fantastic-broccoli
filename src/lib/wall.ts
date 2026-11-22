/**
 * The subscribe wall's rules and words, kept pure so they can be tested:
 * when the post-session wall may open, why a wall opened (for the funnel),
 * what a refusal says to a student, which plan bullets are true, and how the
 * Exam Pass is pitched against the student's exam date.
 *
 * PRESENTATION ONLY. Nothing here decides price, entitlement, caps or what
 * checkout does; caps and token charges stay on the server.
 */
import { PLAN_LIMIT_ERROR_PREFIX } from "./api/plan-limit";
import { planBilling, type PlanLabelInput } from "./plan-display";

/* ---------- When the post-session wall may open ---------- */

/**
 * The post-session wall never covers a student's first completed session.
 * It opens on the end screen of a FULL session (never a Quick 5, whose end
 * screen asks "When do you usually study?" instead: one ask per end screen),
 * from the second completed full session on, once per device.
 */
export const POST_SESSION_MIN_FULL_SESSIONS = 2;

export interface PostSessionInput {
  /** The session whose end screen is showing is a Quick 5. */
  quickStart: boolean;
  /** Completed full (non-Quick 5) sessions, the one just finished included; null when unknown. */
  completedFullSessions: number | null;
  /** The post-session wall was already shown on this device. */
  alreadyShown: boolean;
  /** The student already has a priced plan (paid or granted). */
  hasAccess: boolean;
}

export function postSessionWallDue(input: PostSessionInput): boolean {
  if (input.hasAccess || input.alreadyShown || input.quickStart) return false;
  // Unknown counts never open it: the rule is "never on the first win".
  if (input.completedFullSessions === null) return false;
  return input.completedFullSessions >= POST_SESSION_MIN_FULL_SESSIONS;
}

/** Completed full sessions among `sessions`, counting `currentId` (the end screen showing) as completed. */
export function countCompletedFullSessions(
  sessions: { id: string; quickStart: boolean; status: string }[],
  current: { id: string; quickStart: boolean },
): number {
  const ids = new Set<string>();
  for (const s of sessions) {
    if (!s.quickStart && s.status.toLowerCase() === "completed") ids.add(s.id);
  }
  if (!current.quickStart) ids.add(current.id);
  return ids.size;
}

/* ---------- One ask per end screen ---------- */

export type EndScreenAsk = "habit" | "wall";
const asked = new Map<string, EndScreenAsk>();

/**
 * Claims the single ask an end screen gets. The habit prompt claims first on
 * a Quick 5's end screen; the wall only ever claims on a full session's.
 * Returns false when another ask already holds this end screen.
 */
export function claimEndScreenAsk(sessionId: string, ask: EndScreenAsk): boolean {
  const held = asked.get(sessionId);
  if (held && held !== ask) return false;
  asked.set(sessionId, ask);
  return true;
}

/** Tests only. */
export function resetEndScreenAsks(): void {
  asked.clear();
}

/* ---------- Why the wall opened (funnel `wall.shown {reason}`) ---------- */

/** Server WALL_REASONS (goscribe/server funnel-event.service.ts). Fixed values only. */
export type WallReason =
  | "post_session"
  | "plan_limit_workspaces"
  | "plan_limit_sessions"
  | "plan_limit_tests"
  | "token_limit"
  | "locked_topic"
  | "upgrade_click"
  /** Coursework grader: locked on the plan, or its daily review limit reached. */
  | "grader"
  | "other";

/** Server WALL_VARIANTS: which wall layout was shown. */
export type WallVariant = "post_session" | "limit" | "locked" | "exam_pass" | "default";

/** Classifies a server refusal (cap, token or locked-content message). */
export function wallReason(message: string | null | undefined): WallReason {
  const m = (message ?? "").toLowerCase();
  if (!m) return "other";
  if (/^not enough tokens\b/.test(m)) return "token_limit";
  if (/included with a plan or exam pass/.test(m)) return "locked_topic";
  if (/^coursework review limit\b/.test(m)) return "grader";
  if (/free plan includes \d+ (workspace|subject)/.test(m)) return "plan_limit_workspaces";
  if (/free plan includes \d+ (study session|full study session)/.test(m)) return "plan_limit_sessions";
  if (/free plan includes \d+ flashcard test/.test(m)) return "plan_limit_tests";
  return "other";
}

/* ---------- What a student reads ---------- */

/** "1 subject", "2 subjects". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface FreeCaps {
  workspaces: number;
  studySessions: number;
  flashcardTests: number;
}

/** "one Quick 5 a day, 3 full study sessions, 2 subjects and 2 flashcard tests". */
export function freePlanSummary(caps: FreeCaps): string {
  return `one Quick 5 a day, ${plural(caps.studySessions, "full study session", "full study sessions")}, ${plural(
    caps.workspaces,
    "subject",
    "subjects",
  )} and ${plural(caps.flashcardTests, "flashcard test", "flashcard tests")}`;
}

/**
 * The sentence a student sees for a refusal, in plain words: never "tokens"
 * and never "workspace". `null` when there is nothing better than the
 * caller's own fallback.
 */
export function limitSentence(
  message: string | null | undefined,
  opts: { caps?: FreeCaps | null } = {},
): string | null {
  if (!message) return null;
  const reason = wallReason(message);
  const caps = opts.caps;
  switch (reason) {
    case "token_limit":
      // Free and paid plans both refill monthly (server monthly token grant).
      return "You've used this month's study allowance on your plan. It refills next month.";
    case "plan_limit_workspaces": {
      const n = caps?.workspaces ?? Number(/includes (\d+)/i.exec(message)?.[1] ?? 2);
      return `The free plan includes ${plural(n, "subject", "subjects")}. Your subjects stay free to use; a plan lets you add more.`;
    }
    case "plan_limit_sessions": {
      const n = caps?.studySessions ?? Number(/includes (\d+)/i.exec(message)?.[1] ?? 3);
      return `The free plan includes ${plural(n, "full study session", "full study sessions")}. Your daily Quick 5 stays free.`;
    }
    case "plan_limit_tests": {
      const n = caps?.flashcardTests ?? Number(/includes (\d+)/i.exec(message)?.[1] ?? 2);
      return `The free plan includes ${plural(n, "flashcard test", "flashcard tests")}.`;
    }
    default: {
      // Anything else: the server's first sentence, without the prefix or its upsell.
      const raw = message.startsWith(PLAN_LIMIT_ERROR_PREFIX)
        ? message.slice(PLAN_LIMIT_ERROR_PREFIX.length).replace(/^[:\s]+/, "")
        : message;
      const first = raw.split(/(?<=\.)\s/)[0]?.trim();
      if (!first) return null;
      return (first.charAt(0).toUpperCase() + first.slice(1)).replace(/\bworkspaces?\b/gi, (w) => (w.toLowerCase().endsWith("s") ? "subjects" : "subject"));
    }
  }
}

/* ---------- Plan bullets ---------- */

/**
 * Tokens one new full study session (or one upload's analysis) costs on the
 * server (TOKEN_COSTS.GENERATION). Used only to turn a plan's monthly
 * allowance into "up to N new study sessions a month".
 */
export const SESSION_TOKEN_COST = 40;

export interface PerkPlan extends PlanLabelInput {
  monthlyTokens: number;
  /** Coursework reviews a day from the server (null = unlimited, 0 = not included); undefined on older servers. */
  courseworkReviewsPerDay?: number | null;
}

/** "Coursework reviews: 2 a day" / "Unlimited coursework reviews"; null when the plan has none or the server didn't say. */
export function courseworkPerk(perDay: number | null | undefined): string | null {
  if (perDay === undefined) return null;
  if (perDay === null) return "Unlimited coursework reviews";
  if (perDay <= 0) return null;
  return `${perDay} coursework ${perDay === 1 ? "review" : "reviews"} a day`;
}

/** "Up to 15 new study sessions a month", from the plan's monthly allowance; null when it would say nothing. */
export function sessionsPerMonth(monthlyTokens: number, cost = SESSION_TOKEN_COST): number | null {
  if (!(monthlyTokens > 0) || !(cost > 0)) return null;
  const n = Math.floor(monthlyTokens / cost);
  return n > 0 ? n : null;
}

/**
 * What a paid plan gets, in outcomes. Every line rests on server code:
 * - "Unlimited subjects" and "Unlimited flashcard tests": FREE_TIER_CAPS only
 *   apply without a priced plan (plan-caps.service `getPlanCapsOverview`).
 * - "A Quick 5 whenever you want": `isAtQuickFiveDailyCap` is false on a
 *   priced plan, and a Quick 5 never costs tokens (FREE_TOKEN_EXEMPTIONS).
 * - "Up to N new study sessions a month": the plan's monthly tokens divided
 *   by TOKEN_COSTS.GENERATION (an upload's analysis draws on the same allowance).
 * - "Our strongest AI model": InferenceInput.premium routes every activity
 *   through the strong tier for paid plans.
 * - Coursework reviews: the plan's `courseworkReviewsPerDay` from
 *   payment.getPlans (server COURSEWORK_DAILY_REVIEWS).
 * The last line is how the plan is paid, which is what really separates a
 * subscription from the pass.
 */
export function paidPerks(plan: PerkPlan, opts: { examLine?: string | null } = {}): string[] {
  const billing = planBilling(plan);
  const n = sessionsPerMonth(plan.monthlyTokens);
  const perks = [
    "Unlimited subjects",
    "A Quick 5 whenever you want, not one a day",
    ...(n ? [`Up to ${n} new study sessions a month`] : []),
    "Unlimited flashcard tests",
    "Our strongest AI model on every activity",
  ];
  const coursework = courseworkPerk(plan.courseworkReviewsPerDay);
  if (coursework) perks.push(coursework);
  if (billing === "once") {
    if (opts.examLine) perks.push(opts.examLine);
    perks.push("One payment, nothing renews");
  } else if (billing === "month" || billing === "year") {
    perks.push(billing === "year" ? "Renews every year, cancel anytime" : "Renews every month, cancel anytime");
  }
  return perks;
}

/** The free plan's own list (FREE_TIER_CAPS and the daily Quick 5). */
export function freePerks(caps: FreeCaps): string[] {
  return [
    plural(caps.workspaces, "subject", "subjects"),
    `${plural(caps.studySessions, "full study session", "full study sessions")} and ${plural(caps.flashcardTests, "flashcard test", "flashcard tests")}`,
    "One Quick 5 every day",
  ];
}

/* ---------- The Exam Pass by exam date ---------- */

export interface ExamLike {
  title: string;
  kind: "exam" | "test" | "coursework";
  /** Local day YYYY-MM-DD. */
  date: string;
}

export interface ExamPitch {
  /** The exam day the pitch names (YYYY-MM-DD). */
  date: string;
  /** "Thu 3 Dec". */
  dateLabel: string;
  /** "Everything until your exam on Thu 3 Dec — pay once". */
  headline: string;
  /** An extra bullet for the pass: "Covers your exam on Thu 3 Dec". */
  line: string;
}

/** "Thu 3 Dec" (or the locale's own short form). */
export function formatExamDay(ymd: string, locale = "en-GB"): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  try {
    return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/,/g, "");
  } catch {
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
}

/**
 * Pitches the pass by the student's exam date, or returns null (keep the
 * usual presentation). The named date is the student's last upcoming exam
 * (tests and coursework only when there is no exam) that the pass still
 * covers: a pass whose access ends before that exam is never pitched as
 * covering it. A pass with no end date sent by the server counts as covering.
 */
export function examPassPitch(
  exams: ExamLike[],
  pass: Pick<PlanLabelInput, "accessUntil"> | null | undefined,
  today: string,
  locale = "en-GB",
): ExamPitch | null {
  if (!pass) return null;
  const until = pass.accessUntil ? new Date(pass.accessUntil) : null;
  const untilDay = until && !Number.isNaN(until.getTime()) ? until.toISOString().slice(0, 10) : null;
  const upcoming = exams.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today && (!untilDay || e.date <= untilDay));
  const pool = upcoming.some((e) => e.kind === "exam") ? upcoming.filter((e) => e.kind === "exam") : upcoming;
  if (pool.length === 0) return null;
  const last = pool.reduce((a, b) => (b.date > a.date ? b : a));
  const several = pool.length > 1;
  const dateLabel = formatExamDay(last.date, locale);
  const what = last.kind === "exam" ? (several ? "last exam" : "exam") : several ? "last test" : last.kind === "test" ? "test" : "deadline";
  return {
    date: last.date,
    dateLabel,
    headline: `Everything until your ${what} on ${dateLabel} — pay once`,
    line: `Covers your ${what} on ${dateLabel}`,
  };
}
