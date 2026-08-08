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

export const GUIDED_TOUR_COOKIES = {
  home: "scribe_tour_v1",
  materials: "scribe_tour_materials_v1",
  study: "scribe_tour_study_v1",
} as const;

export type GuidedTourPhase = keyof typeof GUIDED_TOUR_COOKIES;

export function hasCompletedGuidedTour(phase: GuidedTourPhase): boolean {
  if (typeof document === "undefined") return true;
  return new RegExp(`(?:^|; )${GUIDED_TOUR_COOKIES[phase]}=completed`).test(
    document.cookie,
  );
}

export function markGuidedTourCompleted(phase: GuidedTourPhase): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${GUIDED_TOUR_COOKIES[phase]}=completed; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
