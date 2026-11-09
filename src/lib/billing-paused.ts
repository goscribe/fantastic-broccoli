/**
 * Stripe suspended the account (Oct 2026); every user has a complimentary Pro
 * month and checkout cannot succeed. While true, the paywall surfaces
 * (subscribe wall, plan-limit dialog, upgrade nudges) stay hidden and the
 * pricing page explains the pause. Flip to false when billing is back.
 */
export const BILLING_PAUSED = true;
