import { CHECKOUT_UNAVAILABLE_LINE } from "./checkout-failure";

/**
 * What to tell the learner when the hosted checkout (Stripe or Airwallex)
 * sends them back to `/settings?checkout=…`.
 *
 * The return URL proves nothing either way: anyone can open it, and a checkout
 * closed in this tab may have been completed in another. The plan changes only
 * when the server hears from the payment provider, so neither outcome claims a
 * payment or the lack of one; both point at the plan shown on Settings, which
 * is re-read after either return. Checkout is never reopened from here.
 * A student with no subject yet is taken on into the first run (Settings,
 * via landingAfterCheckout) instead of being left on a billing page.
 */
export type CheckoutReturn = { kind: "finished" | "closed" | "failed"; message: string };

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
  // The provider sent the student back without a payment going through.
  if (param === "failed" || param === "error") {
    return { kind: "failed", message: CHECKOUT_UNAVAILABLE_LINE };
  }
  return null;
}

/** Delays (ms) at which Settings re-reads the plan after either return. */
export const CHECKOUT_REFRESH_DELAYS_MS = [3000, 10000, 30000] as const;
