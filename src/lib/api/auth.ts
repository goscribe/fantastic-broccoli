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

function redirectUnauthenticated() {
  const path = window.location.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return;
  window.location.href = path === "/" ? "/landing" : "/login";
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
    api.auth.getSession
      .query()
      .then((session) => {
        const u = (session as { user?: { id: string; name?: string | null; email?: string | null; emailVerified?: boolean } } | null)?.user;
        if (u) {
          setUser({
            id: u.id,
            name: u.name ?? u.email ?? "You",
            email: u.email ?? undefined,
            emailVerified: u.emailVerified,
          });
        } else {
          redirectUnauthenticated();
        }
      })
      .catch(() => {
        redirectUnauthenticated();
      })
      .finally(() => setLoading(false));
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
