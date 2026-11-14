/**
 * What to tell the learner when the hosted checkout (Stripe or Airwallex)
 * sends them back to `/settings?checkout=…`.
 *
 * The return URL proves nothing either way: anyone can open it, and a checkout
 * closed in this tab may have been completed in another. The plan changes only
 * when the server hears from the payment provider, so neither outcome claims a
 * payment or the lack of one; both point at the plan shown on Settings, which
 * is re-read after either return. Checkout is never reopened from here.
 */
export type CheckoutReturn = { kind: "finished" | "closed"; message: string };

export function checkoutReturn(param: string | null | undefined): CheckoutReturn | null {
  if (param === "success") {
    return {
      kind: "finished",
      message:
        "Checkout finished. Your plan updates here once the payment provider confirms it, usually within a minute.",
    };
  }
  if (param === "cancelled") {
    return { kind: "closed", message: "Checkout closed. Check your current plan below." };
  }
  return null;
}

/** Delays (ms) at which Settings re-reads the plan after either return. */
export const CHECKOUT_REFRESH_DELAYS_MS = [3000, 10000, 30000] as const;
