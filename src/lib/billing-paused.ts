/**
 * Emergency switch for paid checkout and upgrade prompts. Airwallex has been
 * configured and verified; existing complimentary subscriptions remain intact.
 * Set true to pause checkout while a payment-provider issue is investigated.
 */
export const BILLING_PAUSED = false;

/** Shown wherever a paid-plan button is pressed while billing is paused. */
export const BILLING_PAUSED_MESSAGE =
  "Billing is paused while our payment provider is down — everyone has Pro for free this month.";
