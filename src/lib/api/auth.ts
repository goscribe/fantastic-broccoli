"use client";

import { useEffect, useState } from "react";
import { api } from "./trpc-client";
import { isLiveApi } from "./config";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
}

const demoUser: AuthUser = { id: "demo-user", name: "Alan" };

/**
 * Current authenticated user from goscribe/server. In live mode, redirects to
 * the server's login page when there is no session; in demo mode returns the
 * demo user.
 */
export function useAuthUser(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(isLiveApi ? null : demoUser);
  const [loading, setLoading] = useState(isLiveApi);

  useEffect(() => {
    if (!isLiveApi) return;
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
  if (!isLiveApi) return;
  await api.auth.login.mutate({ email, password });
}

export async function signOut(): Promise<void> {
  if (!isLiveApi) return;
  await api.auth.logout.mutate();
  window.location.href = "/login";
}
