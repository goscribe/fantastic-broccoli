/**
 * What to tell the learner when the hosted checkout (Stripe or Airwallex)
 * sends them back to `/settings?checkout=…`.
 *
 * The return URL proves nothing: anyone can open it. The plan changes only
 * when the server hears from the payment provider, so "success" is worded as
 * "finished, waiting for confirmation" and never as "you are subscribed".
 */
export type CheckoutReturn =
  | { kind: "pending"; message: string; refresh: true }
  | { kind: "cancelled"; message: string; refresh: false };

export function checkoutReturn(param: string | null | undefined): CheckoutReturn | null {
  if (param === "success") {
    return {
      kind: "pending",
      message:
        "Checkout finished. Your plan updates here once the payment provider confirms it, usually within a minute.",
      refresh: true,
    };
  }
  if (param === "cancelled") {
    return {
      kind: "cancelled",
      message: "Checkout closed. No plan was started.",
      refresh: false,
    };
  }
  return null;
}

/** Delays (ms) at which Settings re-reads the plan after a finished checkout. */
export const CHECKOUT_REFRESH_DELAYS_MS = [3000, 10000, 30000] as const;
