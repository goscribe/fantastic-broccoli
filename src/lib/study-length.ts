/**
 * "How long do you want to study?" before a new session is generated: the
 * slider's range, the depth it implies, the colour and cat it shows, and
 * when to ask. Pure: no React or API imports, so it can be unit tested.
 */
import type { SessionDepth } from "../types";

export const STUDY_LENGTH_MIN = 5;
export const STUDY_LENGTH_MAX = 120;
export const STUDY_LENGTH_STEP = 5;

/** Asked on the first and second session; after that the session's own defaults apply. */
export const ASK_STUDY_LENGTH_UNTIL = 2;

/** Up to this many minutes a Quick 5 stays a Quick 5; longer becomes a full plan of that length. */
export const QUICK_START_MAX_MINUTES = 10;

export type StudyLengthStage = "chill" | "focus" | "sweat" | "drenched";
export const STUDY_LENGTH_STAGES: StudyLengthStage[] = ["chill", "focus", "sweat", "drenched"];

export const STUDY_LENGTH_CATS: Record<StudyLengthStage, string> = {
  chill: "/design/cat3-chill.webp",
  focus: "/design/cat3-focus.webp",
  sweat: "/design/cat3-sweat.webp",
  drenched: "/design/cat3-drenched.webp",
};

export function clampStudyMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 30;
  const snapped = Math.round(minutes / STUDY_LENGTH_STEP) * STUDY_LENGTH_STEP;
  return Math.min(STUDY_LENGTH_MAX, Math.max(STUDY_LENGTH_MIN, snapped));
}

/** Light up to 15 minutes, moderate up to 45, deep beyond. */
export function depthForMinutes(minutes: number): SessionDepth {
  if (minutes <= 15) return "light";
  if (minutes <= 45) return "moderate";
  return "deep";
}

/** Which cat: sipping tea (light), pencil up (moderate), sweating (deep), drenched in a headband (over 75). */
export function stageForMinutes(minutes: number): StudyLengthStage {
  if (minutes <= 15) return "chill";
  if (minutes <= 45) return "focus";
  if (minutes <= 75) return "sweat";
  return "drenched";
}

/** 0 at the shortest session, 1 at the longest. */
export function studyLengthProgress(minutes: number): number {
  return (clampStudyMinutes(minutes) - STUDY_LENGTH_MIN) / (STUDY_LENGTH_MAX - STUDY_LENGTH_MIN);
}

/** Hue stops by minutes: teal, green at half an hour, amber at an hour, red at two. */
const HUE_STOPS: [number, number][] = [
  [STUDY_LENGTH_MIN, 170],
  [30, 130],
  [60, 38],
  [STUDY_LENGTH_MAX, 0],
];

export function colorForMinutes(minutes: number): string {
  const m = clampStudyMinutes(minutes);
  let hue = 0;
  for (let i = 1; i < HUE_STOPS.length; i++) {
    const [m0, h0] = HUE_STOPS[i - 1];
    const [m1, h1] = HUE_STOPS[i];
    if (m <= m1) {
      hue = h0 + ((h1 - h0) * (m - m0)) / (m1 - m0);
      break;
    }
  }
  return `hsl(${Math.round(hue)} 78% 44%)`;
}

/** Whether to ask before generating, given how many sessions the learner already has. */
export function shouldAskStudyLength(existingSessions: number | null): boolean {
  return existingSessions != null && existingSessions < ASK_STUDY_LENGTH_UNTIL;
}

/** "5 min", "45 min", "1 h", "1 h 30 min" in the minimal form the slider label uses. */
export function formatStudyLength(minutes: number, labels: { min: string; h: string }): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} ${labels.min}`;
  return m ? `${h} ${labels.h} ${m} ${labels.min}` : `${h} ${labels.h}`;
}

export interface StudyLengthInput {
  depth: SessionDepth;
  durationMinutes: number;
  quickStart?: boolean;
}

/**
 * The create input with the learner's answer applied: their minutes and the
 * depth those imply. A Quick 5 asked for more than ten minutes becomes a full
 * plan of that length, so the answer is never ignored.
 */
export function applyStudyLength<T extends StudyLengthInput>(input: T, minutes: number): T {
  const durationMinutes = clampStudyMinutes(minutes);
  const out: T = { ...input, durationMinutes, depth: depthForMinutes(durationMinutes) };
  if (input.quickStart && durationMinutes > QUICK_START_MAX_MINUTES) out.quickStart = false;
  return out;
}
