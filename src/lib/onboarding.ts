"use client";

export const GUIDED_TOUR_COOKIES = {
  home: "scribe_tour_v1",
  materials: "scribe_tour_materials_v1",
  analysis: "scribe_tour_analysis_v1",
  study: "scribe_tour_study_v1",
  wizard: "scribe_tour_wizard_v1",
  firstFile: "scribe_tour_first_file_v1",
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
