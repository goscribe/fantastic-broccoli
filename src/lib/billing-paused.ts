/**
 * Paid plans are off: the Stripe account was suspended (Oct 2026) and every
 * user has complimentary Pro. While true, the paywall surfaces (subscribe
 * wall, plan-limit dialog, upgrade nudges, the Settings upgrade link) stay
 * hidden and the pricing page explains the pause instead of opening checkout.
 *
 * Keep true until a payment provider (Stripe or Airwallex; the server picks
 * via BILLING_PROVIDER) has been verified end to end. Flipping this is the
 * only frontend change needed to show checkout again.
 */
export const BILLING_PAUSED = true;

/** Shown wherever a paid-plan button is pressed while billing is paused. */
export const BILLING_PAUSED_MESSAGE =
  "Billing is paused while our payment provider is down — everyone has Pro for free this month.";
