"use client";

export const ONBOARDING_COOKIE = "scribe_onboarding_v1";
export const ONBOARDING_DATE = "2026-08-04";

export type OnboardingState = {
  date: string;
  status: "started" | "completed";
};

function parseCookie(): OnboardingState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ONBOARDING_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const [date, status] = decoded.split("|");
    if (date !== ONBOARDING_DATE) return null;
    return { date, status: status === "completed" ? "completed" : "started" };
  } catch {
    return null;
  }
}

export function hasCompletedOnboarding(): boolean {
  return parseCookie()?.status === "completed";
}

export function markOnboarding(status: "started" | "completed"): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(`${ONBOARDING_DATE}|${status}`);
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${ONBOARDING_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function getOnboardingState(): OnboardingState | null {
  return parseCookie();
}
