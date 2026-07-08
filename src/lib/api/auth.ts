"use client";

import { useEffect, useState } from "react";
import { api } from "./trpc-client";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
}

const PUBLIC_PATHS = ["/landing", "/login", "/signup", "/forgot-password"];

/** Returns true when a redirect was initiated. */
function redirectUnauthenticated(): boolean {
  const path = window.location.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }
  window.location.href = path === "/" ? "/landing" : "/login";
  return true;
}

type SessionResult = Awaited<ReturnType<typeof api.auth.getSession.query>>;

// One in-flight session fetch shared by every useAuthUser instance, so the
// shell, top bar, and page all resolve auth at the same moment.
let sessionPromise: Promise<SessionResult> | null = null;
function getSessionOnce(): Promise<SessionResult> {
  sessionPromise ??= api.auth.getSession.query();
  return sessionPromise;
}

/**
 * Current authenticated user from goscribe/server. Redirects to the landing
 * page (from /) or login page when there is no session, except on public
 * pages.
 */
export function useAuthUser(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // While an unauthenticated redirect is navigating, stay in the loading
    // state so protected content never flashes before the browser leaves.
    getSessionOnce()
      .then((session) => {
        const u = (session as { user?: { id: string; name?: string | null; email?: string | null; emailVerified?: boolean } } | null)?.user;
        if (u) {
          setUser({
            id: u.id,
            name: u.name ?? u.email ?? "You",
            email: u.email ?? undefined,
            emailVerified: u.emailVerified,
          });
          setLoading(false);
        } else if (!redirectUnauthenticated()) {
          setLoading(false);
        }
      })
      .catch(() => {
        sessionPromise = null;
        if (!redirectUnauthenticated()) setLoading(false);
      });
  }, []);

  return { user, loading };
}

export async function signIn(email: string, password: string): Promise<void> {
  await api.auth.login.mutate({ email, password });
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await api.auth.signup.mutate({ name, email, password });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.auth.requestPasswordReset.mutate({ email });
}

export async function resendVerification(): Promise<void> {
  await api.auth.resendVerification.mutate();
}

export async function signOut(): Promise<void> {
  await api.auth.logout.mutate();
  window.location.href = "/login";
}
