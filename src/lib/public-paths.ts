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
];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
