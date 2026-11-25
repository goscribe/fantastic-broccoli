"use client";

import { api } from "./trpc-client";
import { rpc } from "./study-session";

export interface AccountSummary {
  planName: string;
  hasActivePlan: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  tokenBalance: number;
  monthlyTokens: number;
}

export async function fetchAccountSummary(): Promise<AccountSummary> {
  const overview = await api.payment.getUsageOverview.query();
  // `tokens` is newer than the published @goscribe/server types.
  const tokens = (
    overview as unknown as {
      tokens?: { balance: number; monthlyAllowance: number; planName?: string };
    }
  ).tokens;
  return {
    planName: tokens?.planName ?? (overview.hasActivePlan ? "Pro" : "Free"),
    hasActivePlan: overview.hasActivePlan,
    storageUsedBytes: Number(overview.usage.storageBytes),
    storageLimitBytes: Number(overview.limits.maxStorageBytes),
    tokenBalance: tokens?.balance ?? 0,
    monthlyTokens: tokens?.monthlyAllowance ?? 0,
  };
}

/** Free-plan resource caps (see server FREE_TIER_CAPS); `caps` is null on a paid or complimentary plan. */
export interface PlanCaps {
  /** The user pays (active or trialing provider subscription). False on a complimentary grant. */
  paid: boolean;
  /**
   * On a priced plan only through a complimentary grant (no payment). Has plan
   * access, but is not a paid conversion. Absent from servers before it was added.
   */
  complimentary?: boolean;
  /**
   * An admin gave this account the top tier for free, with no end date. Shown
   * as "Unlimited · free": no renewal date and nothing to buy. Independent of
   * `paid` (the user may still pay for a plan of their own). Absent from
   * servers before it was added.
   */
  unlimitedGrant?: boolean;
  caps: {
    workspaces: number;
    studySessions: number;
    flashcardTests: number;
  } | null;
  used: { workspaces: number; studySessions: number; flashcardTests: number };
  /** Free-trial length offered at checkout; 0 once the account has used it. */
  trialDays: number;
  /** When the current trial converts to a paid subscription, if trialing. */
  trialEndsAt: Date | string | null;
  completedSessions: number;
  /** The plan the user pays for, with its price in dollars (the paid-conversion value). Newer servers only. */
  paidPlan?: { id: string; price: number; kind: "pass" | "recurring" } | null;
  /** Set while the user holds an exam pass: when it ends (it never renews). */
  passEndsAt?: Date | string | null;
}

/** Fired on `window` when the learner finishes a study session (debrief shown). */
export const SESSION_COMPLETED_EVENT = "scribe:session-completed";

/** `detail` of SESSION_COMPLETED_EVENT: which end screen is showing (the wall never opens on a Quick 5's). */
export interface SessionCompletedDetail {
  sessionId: string;
  quickStart?: boolean;
}

export function fetchPlanCaps(): Promise<PlanCaps> {
  return rpc<PlanCaps>("payment.getPlanCaps", "query", undefined);
}

export {
  PLAN_LIMIT_ERROR_PREFIX,
  PLAN_LIMIT_EVENT,
  announcePlanLimit,
  isPlanLimitError,
} from "./plan-limit";

/** Server token cost table, keyed by operation (see server TOKEN_COSTS). */
export interface TokenCosts {
  GENERATION: number;
  FLASHCARD_SET: number;
  WORKSHEET: number;
  STUDY_GUIDE: number;
  PODCAST_EPISODE: number;
  ARTIFACT_SEARCH: number;
  EXPORT_ASSIST: number;
}

export interface TokenOverview {
  balance: number;
  monthlyAllowance: number;
  planName: string;
  costs: TokenCosts;
}

export type TokenTransactionType =
  "MONTHLY_GRANT" | "TOPUP" | "SPEND" | "ADJUSTMENT";

export interface TokenLedgerEntry {
  id: string;
  amount: number;
  type: TokenTransactionType;
  description: string | null;
  createdAt: string | Date;
}

export function fetchTokenOverview(): Promise<TokenOverview> {
  return rpc<TokenOverview>("payment.getTokenOverview", "query", undefined);
}

export function fetchTokenHistory(limit = 50): Promise<TokenLedgerEntry[]> {
  return rpc<TokenLedgerEntry[]>("payment.getTokenHistory", "query", {
    limit,
  });
}

/** Human label for a ledger entry (spend descriptions are tRPC paths). */
export function describeLedgerEntry(entry: TokenLedgerEntry): string {
  if (entry.type === "MONTHLY_GRANT") return "Monthly plan tokens";
  if (entry.type === "TOPUP") return "Token top-up";
  if (entry.type === "ADJUSTMENT")
    return entry.description ?? "Balance adjustment";
  const s = (entry.description ?? "").toLowerCase();
  if (s.includes("generatebank")) return "Question bank generation";
  if (s.includes("retrygeneration") || s.includes("regenerate"))
    return "Study session · retry";
  if (s.includes("studysession")) return "Study session";
  if (s.includes("upload") || s.includes("analyze") || s.includes("analysis"))
    return "Material upload & analysis";
  if (s.includes("podcast")) return "Podcast episode";
  if (s.includes("flashcard")) return "Flashcard set";
  if (s.includes("worksheet")) return "Worksheet";
  if (s.includes("guide")) return "Study guide";
  if (s.includes("search") || s.includes("finder")) return "AI artifact search";
  if (s.includes("export")) return "AI export assist";
  return entry.description ?? "AI generation";
}

export interface PlanOption {
  id: string;
  name: string;
  /** Monthly price in whole dollars (matches `Plan.price` on the server). */
  priceDollars: number;
  description: string;
  storageLimitBytes: number;
  monthlyTokens: number;
  isActive: boolean;
  /** Billing interval ("month", "year"); null for a pay-once plan. Undefined when the server does not send it. Labels only (plan-display.ts). */
  interval?: string | null;
  /** `pass`: paid once, access until `accessUntil`, never renews. */
  kind: "pass" | "recurring";
  /** When a pass's access ends (ISO); null for a monthly plan. */
  accessUntil: string | null;
  /** Coursework reviews a day (null = unlimited, 0 = not included); undefined on servers without the grader. Labels only. */
  courseworkReviewsPerDay?: number | null;
}

export async function fetchPlanOptions(): Promise<PlanOption[]> {
  const plans = await api.payment.getPlans.query();
  return plans.map((plan) => {
    // Display-only fields; `kind` / `accessUntil` are newer than the published @goscribe/server types.
    const extra = plan as unknown as { interval?: string | null; kind?: string | null; accessUntil?: string | Date | null; courseworkReviewsPerDay?: number | null };
    return {
      id: plan.id,
      name: plan.name,
      priceDollars: plan.price,
      description: plan.description ?? "",
      storageLimitBytes: Number(plan.limit?.maxStorageBytes ?? 0),
      // `monthlyTokens` is newer than the published @goscribe/server types.
      monthlyTokens:
        (plan as unknown as { monthlyTokens?: number }).monthlyTokens ?? 0,
      isActive: plan.isActive,
      interval: extra.interval,
      ...passFields(extra),
      courseworkReviewsPerDay: extra.courseworkReviewsPerDay,
    };
  });
}

function passFields(plan: { kind?: string | null; accessUntil?: string | Date | null; interval?: string | null }) {
  const accessUntil = plan.accessUntil ? new Date(plan.accessUntil).toISOString() : null;
  const kind: PlanOption["kind"] =
    plan.kind === "pass" || (!plan.kind && accessUntil && !plan.interval) ? "pass" : "recurring";
  return { kind, accessUntil };
}

/** Redirects to the hosted checkout (Stripe or Airwallex; the server picks) for the chosen paid plan. */
export async function switchPlan(planId: string): Promise<void> {
  const session = await api.payment.createCheckoutSession.mutate({ planId });
  if (session.url) window.location.href = session.url;
}

/** The learner's manageable subscription, including an overdue one without paid access. */
export interface CurrentSubscription {
  id: string;
  planId: string;
  planName: string;
  status: string;
  isTrial: boolean;
  /** When the trial converts / the plan renews (or ends, if cancelling). */
  currentPeriodEnd: Date | string;
  /** Set when the subscription is scheduled to end at the period end. */
  cancelAt: Date | string | null;
  /** A one-off exam pass: ends at `currentPeriodEnd`, nothing to cancel or resume. */
  isPass?: boolean;
}

export function fetchCurrentSubscription(): Promise<CurrentSubscription | null> {
  return rpc<CurrentSubscription | null>(
    "payment.getCurrentSubscription",
    "query",
    undefined,
  );
}

/**
 * Downgrade to free: the paid plan (or trial) ends when the current period
 * does; nothing further is charged and access continues until then.
 */
export function cancelSubscription(): Promise<CurrentSubscription> {
  return rpc<CurrentSubscription>(
    "payment.cancelSubscription",
    "mutation",
    undefined,
  );
}

export function resumeSubscription(): Promise<CurrentSubscription> {
  return rpc<CurrentSubscription>(
    "payment.resumeSubscription",
    "mutation",
    undefined,
  );
}

export async function updateProfile(name: string): Promise<void> {
  await api.auth.updateProfile.mutate({ name });
}

/**
 * Persists the user's preferred language (UI + generated study content).
 * Raw rpc because the published @goscribe/server types predate the
 * `preferredLanguage` field on auth.updateProfile.
 */
export async function updatePreferredLanguage(code: string): Promise<void> {
  await rpc("auth.updateProfile", "mutation", { preferredLanguage: code });
}

/**
 * Uploads a new profile picture: asks the server for a signed upload URL,
 * PUTs the file straight to storage, then tells the server to broadcast the
 * change. Callers should refreshSession() afterwards to pick up the new URL.
 */
export async function uploadProfilePicture(file: File): Promise<void> {
  const { signedUrl } = await api.auth.uploadProfilePicture.mutate();
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Failed to upload image. Please try again.");
  }
  await api.auth.confirmProfileUpdate.mutate();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
