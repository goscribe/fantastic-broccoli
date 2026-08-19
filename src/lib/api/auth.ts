"use client";

import { useEffect, useState } from "react";
import { api } from "./trpc-client";
import { rpc } from "./study-session";
import { apiUrl } from "./config";
import { getSignupAttribution } from "@/lib/attribution";
import { syncUiLocale } from "@/lib/i18n";

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  emailVerified?: boolean;
  profilePicture?: string | null;
  role?: string | null;
  isAdmin: boolean;
  preferredLanguage?: string;
}

export const SYSTEM_ADMIN_ROLE = "System Admin";

const PUBLIC_PATHS = [
  "/landing",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/privacy",
  "/terms",
];

/** Returns true when a redirect was initiated. */
function redirectUnauthenticated(): boolean {
  const path = window.location.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return false;
  }
  window.location.href =
    path === "/"
      ? "/landing"
      : `/login?redirect=${encodeURIComponent(path + window.location.search)}`;
  return true;
}

type SessionResult = Awaited<ReturnType<typeof api.auth.getSession.query>>;

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  profilePicture?: string | null;
  role?: { id: string; name: string } | null;
  preferredLanguage?: string;
};

// getSession returns the profile picture as a path relative to the API host
// (e.g. "/profile-picture/<key>?t=..."); make it absolute so <img> resolves it.
function toAuthUser(session: SessionResult): AuthUser | null {
  const u = (session as { user?: SessionUser } | null)?.user;
  if (!u) return null;
  // Cross-device sync: adopt the server-side language preference for the UI.
  syncUiLocale(u.preferredLanguage);
  return {
    id: u.id,
    name: u.name ?? u.email ?? "You",
    email: u.email ?? undefined,
    emailVerified: u.emailVerified,
    role: u.role?.name ?? null,
    isAdmin: u.role?.name === SYSTEM_ADMIN_ROLE,
    preferredLanguage: u.preferredLanguage,
    profilePicture: u.profilePicture
      ? u.profilePicture.startsWith("http")
        ? u.profilePicture
        : `${apiUrl}${u.profilePicture}`
      : null,
  };
}

// One in-flight session fetch shared by every useAuthUser instance, so the
// shell, top bar, and page all resolve auth at the same moment.
let sessionPromise: Promise<SessionResult> | null = null;
function getSessionOnce(): Promise<SessionResult> {
  sessionPromise ??= api.auth.getSession.query();
  return sessionPromise;
}

const sessionListeners = new Set<(user: AuthUser | null) => void>();

/**
 * Re-fetches the session and notifies every mounted useAuthUser consumer.
 * Call after mutating the profile (e.g. uploading a new picture) so the top
 * bar and settings avatar update without a full page reload.
 */
export async function refreshSession(): Promise<void> {
  sessionPromise = null;
  const session = await getSessionOnce();
  const user = toAuthUser(session);
  sessionListeners.forEach((listener) => listener(user));
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
    sessionListeners.add(setUser);
    // While an unauthenticated redirect is navigating, stay in the loading
    // state so protected content never flashes before the browser leaves.
    getSessionOnce()
      .then((session) => {
        const u = toAuthUser(session);
        if (u) {
          setUser(u);
          setLoading(false);
        } else if (!redirectUnauthenticated()) {
          setLoading(false);
        }
      })
      .catch(() => {
        sessionPromise = null;
        if (!redirectUnauthenticated()) setLoading(false);
      });
    return () => {
      sessionListeners.delete(setUser);
    };
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
  // Raw rpc because the published @goscribe/server types predate the
  // signup `attribution` field (see study-session.ts).
  await rpc("auth.signup", "mutation", {
    name,
    email,
    password,
    attribution: getSignupAttribution(),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.auth.requestPasswordReset.mutate({ email });
}

export async function resendVerification(): Promise<void> {
  await api.auth.resendVerification.mutate();
}

export async function verifyEmail(token: string): Promise<void> {
  await api.auth.verifyEmail.mutate({ token });
}

export async function signOut(): Promise<void> {
  await api.auth.logout.mutate();
  window.location.href = "/login";
}
