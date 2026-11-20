/**
 * Exam passes and "Ask a parent to pay" helpers shared by the subscribe wall,
 * the pricing page, Settings and the public /pay/<token> page. Pure: no
 * React, no fetch, so they are unit-tested (src/lib/pass.test.ts).
 */

export interface PassLike {
  id: string;
  name: string;
  kind?: "pass" | "recurring";
  accessUntil?: string | Date | null;
}

/** One payment, fixed end date, never renews. */
export function isPass(plan: PassLike): boolean {
  return plan.kind === "pass" || (!!plan.accessUntil && plan.kind !== "recurring");
}

/** Year the pass ends in (its exam season), from `accessUntil`. */
export function passYear(plan: PassLike): number | null {
  if (!plan.accessUntil) return null;
  const d = new Date(plan.accessUntil);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

/**
 * Which headline a pass gets: "Until your 2027 exams" or "Until graduation
 * 2028". Returns an i18n key and its `{year}`.
 */
export function passTitle(plan: PassLike): { key: "bill.passExams" | "bill.passGraduation"; year: number } | null {
  const year = passYear(plan);
  if (!isPass(plan) || year === null) return null;
  const graduation = /graduat/i.test(`${plan.id} ${plan.name}`);
  return { key: graduation ? "bill.passGraduation" : "bill.passExams", year };
}

/** `15 July 2027` in the UI locale; the date is a UTC calendar day. */
export function formatPassDate(value: string | Date, locale = "en"): string {
  const date = new Date(value);
  try {
    return date.toLocaleDateString(locale === "en" ? "en-GB" : locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Whole months of access left (at least 1), for "about $3.60/month" copy. */
export function monthsLeft(accessUntil: string | Date, now: Date = new Date()): number {
  const ms = new Date(accessUntil).getTime() - now.getTime();
  return Math.max(1, Math.round(ms / (30.44 * 24 * 60 * 60 * 1000)));
}

/** Effective monthly price of a pass bought now, rounded to cents. */
export function perMonth(price: number, accessUntil: string | Date, now: Date = new Date()): number {
  return Math.round((price / monthsLeft(accessUntil, now)) * 100) / 100;
}

/** Replaces `{name}` placeholders. */
export const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

/** Deep links for the share step. The text already contains the URL. */
export function shareTargets(input: { text: string; subject: string }) {
  const text = encodeURIComponent(input.text);
  return {
    whatsapp: `https://wa.me/?text=${text}`,
    // `?&body=` works on both iOS and Android Messages.
    sms: `sms:?&body=${text}`,
    email: `mailto:?subject=${encodeURIComponent(input.subject)}&body=${text}`,
  };
}

/**
 * The value of the Google Ads paid conversion: the plan the server says the
 * user pays for (a pass reports 29 / 59), else the active priced plan.
 */
export function paidConversionPlan(
  caps: { paidPlan?: { id: string; price: number } | null },
  plans: { id: string; priceDollars: number; isActive: boolean }[],
): { id: string; price: number } | null {
  if (caps.paidPlan && caps.paidPlan.price > 0) return { id: caps.paidPlan.id, price: caps.paidPlan.price };
  const active = plans.find((p) => p.isActive && p.priceDollars > 0);
  return active ? { id: active.id, price: active.priceDollars } : null;
}
