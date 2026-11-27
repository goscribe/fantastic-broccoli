"use client";

/**
 * Browser memory of the confidence question: "Skip" keeps it quiet for a
 * week for the same thing. Shared by the start step before a session
 * (src/lib/start-step-client.ts) and the question on a Quick 5's wait screen
 * (src/components/session/wait-confidence.tsx).
 */
import { skippedRecently } from "@/lib/start-check";

const SKIP_KEY = "scribe.start-check.skipped";

function readSkips(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(SKIP_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** "Skip" was tapped on this check lately. */
export function startCheckSkipped(key: string): boolean {
  if (typeof window === "undefined") return false;
  return skippedRecently(readSkips()[key], Date.now());
}

export function rememberSkip(key: string): void {
  try {
    const now = Date.now();
    const kept = Object.fromEntries(Object.entries(readSkips()).filter(([, at]) => skippedRecently(at, now)));
    window.localStorage.setItem(SKIP_KEY, JSON.stringify({ ...kept, [key]: now }));
  } catch {
    // Storage blocked: asked again next time.
  }
}

const RATED_KEY = "scribe.start-check.rated";
/** The server asks again after 30 days (CONFIDENCE_FRESH_DAYS). */
const RATED_QUIET_MS = 30 * 86_400_000;

function readRated(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(RATED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * A course rated from this browser in the last 30 days. The server keeps
 * ratings per topic and per subject; a start from the course catalog knows
 * neither the subject nor, for a new topic, a rating, and would ask on every
 * new topic. This keeps it to once per course.
 */
export function ratedRecently(key: string): boolean {
  if (typeof window === "undefined") return false;
  const at = readRated()[key];
  return typeof at === "number" && at > 0 && Date.now() - at < RATED_QUIET_MS;
}

export function rememberRated(key: string): void {
  try {
    const now = Date.now();
    const kept = Object.fromEntries(Object.entries(readRated()).filter(([, at]) => now - at < RATED_QUIET_MS));
    window.localStorage.setItem(RATED_KEY, JSON.stringify({ ...kept, [key]: now }));
  } catch {
    // Storage blocked: asked again on the next new topic.
  }
}
