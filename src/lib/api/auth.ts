"use client";

import { useEffect, useState } from "react";
import { api } from "./trpc-client";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
}

/**
 * Current authenticated user from goscribe/server. Redirects to the login
 * page when there is no session.
 */
export function useAuthUser(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.getSession
      .query()
      .then((session) => {
        const u = (session as { user?: { id: string; name?: string | null; email?: string | null } } | null)?.user;
        if (u) {
          setUser({ id: u.id, name: u.name ?? u.email ?? "You", email: u.email ?? undefined });
        } else {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
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

export async function signOut(): Promise<void> {
  await api.auth.logout.mutate();
  window.location.href = "/login";
}
