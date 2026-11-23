/**
 * Who can open Coursework, and where a student without it is sent to get it.
 * Pure, so it is tested (coursework-access.test.ts).
 *
 * PRESENTATION ONLY. Access, credits and plan caps come from the server
 * (goscribe/server lib/coursework/limits.ts: `coursework.status` and the
 * plan list's `courseworkReviewsPerDay`); these read its answers.
 */

/** The parts of `coursework.status` this needs (`access` and `creditsLeft` are absent on an older server). */
export interface AccessStatus {
  reason: "locked" | "daily_limit" | "abuse_cap" | null;
  access?: boolean;
  creditsLeft?: number;
}

/**
 * open: the plan includes reviews, or the student has free review credits;
 * locked: neither. A locked Coursework is still shown everywhere (muted,
 * with a crown) and leads to the upgrade page.
 */
export type CourseworkAccess = "open" | "locked";

export function courseworkAccess(status: AccessStatus): CourseworkAccess {
  if (typeof status.access === "boolean") return status.access ? "open" : "locked";
  return status.reason !== "locked" || (status.creditsLeft ?? 0) > 0 ? "open" : "locked";
}

/** Free review credits left (never negative; 0 on an older server). */
export function creditsLeft(status: Pick<AccessStatus, "creditsLeft"> | null | undefined): number {
  return Math.max(0, Math.floor(status?.creditsLeft ?? 0));
}

/** "5 free reviews left", "1 free review left", or null with none. */
export function creditsLine(n: number): string | null {
  if (!(n > 0)) return null;
  return `${n} free ${n === 1 ? "review" : "reviews"} left`;
}

/**
 * Where a locked Coursework goes: the pricing page with the plan for
 * coursework picked. The page picks Ultra when it is on sale and otherwise
 * the best plan the server lists with coursework reviews (Pro), see
 * `pricingPick`.
 */
export const COURSEWORK_UPGRADE_HREF = "/pricing?plan=ultra&for=coursework";

export interface PricingQuery {
  /** A plan to pick, by name ("ultra") or id. */
  plan: string | null;
  /** What the student came for: "coursework" picks the plan with the most coursework reviews when `plan` is not on sale. */
  for: string | null;
}

export function parsePricingQuery(search: string): PricingQuery {
  const q = new URLSearchParams(search);
  const clean = (v: string | null) => v?.trim().toLowerCase().slice(0, 64) || null;
  return { plan: clean(q.get("plan")), for: clean(q.get("for")) };
}

export interface PickablePlan {
  id: string;
  name: string;
  priceDollars: number;
  isActive: boolean;
  /** Server `courseworkReviewsPerDay`: null = unlimited, 0 = none, absent = an older server that does not say. */
  courseworkReviewsPerDay?: number | null;
}

/** Coursework reviews a day as a rank: unlimited first; null when the plan has none or the server does not say. */
function courseworkRank(p: PickablePlan): number | null {
  if (p.courseworkReviewsPerDay === undefined) return null;
  if (p.courseworkReviewsPerDay === null) return Number.POSITIVE_INFINITY;
  return p.courseworkReviewsPerDay > 0 ? p.courseworkReviewsPerDay : null;
}

/**
 * The plan to select on the pricing page for this query, from the plans the
 * server lists (Ultra is listed only while its price is configured), or null
 * for the page's own default. A plan the student is already on is never
 * picked. `plan` wins when it is on sale; otherwise `for=coursework` picks
 * the plan with the most coursework reviews a day (the cheaper on a tie),
 * so a link asking for Ultra lands on Pro while Ultra is not for sale.
 */
export function pricingPick(plans: PickablePlan[], query: PricingQuery): string | null {
  const buyable = plans.filter((p) => p.priceDollars > 0 && !p.isActive);
  if (query.plan) {
    const asked = buyable.find((p) => p.id.toLowerCase() === query.plan || p.name.trim().toLowerCase() === query.plan);
    if (asked) return asked.id;
  }
  if (query.for !== "coursework") return null;
  const ranked = buyable
    .map((p) => ({ p, rank: courseworkRank(p) }))
    .filter((x): x is { p: PickablePlan; rank: number } => x.rank !== null)
    .sort((a, b) => b.rank - a.rank || a.p.priceDollars - b.p.priceDollars);
  return ranked[0]?.p.id ?? null;
}
