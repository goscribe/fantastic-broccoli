/**
 * How a plan is LABELLED on Pricing, Settings › Plan and the paywall. Labels
 * only: nothing here decides price, entitlement or what checkout does.
 *
 * Two kinds of paid plan are sold: a subscription (billed every month or
 * year, and it starts with a free trial when the account has not had one) and
 * a pay-once pass (one payment, no trial, no renewal). A pass must never be
 * labelled "/ month" or "then $X/month after N days".
 */
export interface PlanLabelInput {
  name: string;
  priceDollars: number;
  description?: string | null;
  /** Billing interval from the server: "month", "year", or null for a one-off purchase. Missing = monthly (older servers). */
  interval?: string | null;
  /** "pass" marks a pay-once plan even if `interval` is missing. */
  kind?: string | null;
  /** For a pass: when its access ends. */
  accessUntil?: string | Date | null;
}

export type PlanBilling = "free" | "month" | "year" | "once";

/** "free" → "Free", "starter" → "Starter", "exam_pass" → "Exam Pass"; a name that already has capitals is kept as written. */
export function planDisplayName(name: string): string {
  const clean = name.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!clean) return "Plan";
  if (/[A-Z]/.test(clean)) return clean;
  return clean.replace(/(^|\s)([a-z])/g, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

export function planBilling(plan: PlanLabelInput): PlanBilling {
  if (plan.priceDollars <= 0) return "free";
  if (plan.kind === "pass" || plan.interval === null) return "once";
  const interval = (plan.interval ?? "month").toLowerCase();
  return /^(year|yearly|annual|annually)$/.test(interval) ? "year" : "month";
}

/** The price and what follows it: "$5" + " / month", "$29" + " once", "Free" + "". */
export function planPriceLabel(plan: PlanLabelInput): { amount: string; suffix: string } {
  const billing = planBilling(plan);
  if (billing === "free") return { amount: "Free", suffix: "" };
  const amount = `$${plan.priceDollars}`;
  return { amount, suffix: billing === "once" ? " once" : billing === "year" ? " / year" : " / month" };
}

/** "$5/month", "$48/year", "$29 once": the price inside a sentence. */
export function planPriceInline(plan: PlanLabelInput): string {
  const billing = planBilling(plan);
  if (billing === "free") return "Free";
  return billing === "once" ? `$${plan.priceDollars} once` : `$${plan.priceDollars}/${billing}`;
}

/** Trial days that apply to THIS plan: only a subscription has a trial. */
export function planTrialDays(plan: PlanLabelInput, accountTrialDays: number): number {
  const billing = planBilling(plan);
  return billing === "month" || billing === "year" ? Math.max(0, accountTrialDays) : 0;
}

/** The buy button: "Try for free" for a subscription that starts with a trial, "Get started" otherwise (a pass, or no trial left). */
export function planCta(plan: PlanLabelInput, accountTrialDays: number): string {
  return planTrialDays(plan, accountTrialDays) > 0 ? "Try for free" : "Get started";
}

function formatUntil(value: string | Date): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The line under the price that says what will be charged and when.
 * Subscription with a trial: "$0 today, then $5/month after 7 days. Cancel before then and pay nothing."
 * Pass: "One payment. Access until Jul 15, 2027." Free, or a subscription with no trial: null.
 */
export function planTermsLine(plan: PlanLabelInput, accountTrialDays: number, opts: { afterZeroToday?: boolean } = {}): string | null {
  const billing = planBilling(plan);
  if (billing === "free") return null;
  if (billing === "once") {
    const until = plan.accessUntil ? formatUntil(plan.accessUntil) : null;
    return until ? `One payment. Access until ${until}.` : "One payment. No subscription.";
  }
  const days = planTrialDays(plan, accountTrialDays);
  if (days <= 0) return null;
  // Where the big price already reads "$0 today" (the paywall), the line starts at "Then".
  const rest = `${planPriceInline(plan)} after ${days} days. Cancel before then and pay nothing.`;
  return opts.afterZeroToday ? `Then ${rest}` : `$0 today, then ${rest}`;
}

/** The plan's description, unless it only repeats its name ("free" / "Free"). */
export function planDescription(plan: PlanLabelInput): string | null {
  const d = plan.description?.trim();
  if (!d) return null;
  return d.toLowerCase() === planDisplayName(plan.name).toLowerCase() ? null : d;
}
