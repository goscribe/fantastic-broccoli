/** Routes reachable without signing in (marketing, auth, legal, design previews). */
export const PUBLIC_PATHS = [
  "/landing",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/restore-account",
  "/accept-invite",
  "/privacy",
  "/terms",
  "/design",
  // Public topic notes + practice questions (server-rendered, indexable).
  "/notes",
  // Invite landing (/i/<code>) and shared quizzes/decks (/s/<token>).
  "/i",
  "/s",
  // "Ask a parent to pay" links (/pay/<token>): the payer has no account.
  "/pay",
  // One-click "Refund my pass" / cancel-trial links (/refund/<signed token>).
  "/refund",
];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
