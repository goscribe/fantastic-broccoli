"use client";

/**
 * Browser side of "How long do you want to study?": whether it is due (a
 * learner's first and second session) and their last answer. The question
 * itself is asked on the start step (src/lib/start-step-client.ts), on the
 * same screen as everything else asked before a session.
 */
import { fetchHomeSummary } from "@/lib/api/home";
import { clampStudyMinutes, shouldAskStudyLength } from "@/lib/study-length";

/** Set once the learner has two sessions, so later starts skip the count. */
const DONE_KEY = "scribe.study-length.done";
/** Their last answer, the slider's starting point next time. */
const LAST_KEY = "scribe.study-length.last";

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function existingSessions(): Promise<number | null> {
  if (readFlag(DONE_KEY)) return null;
  try {
    const summary = await fetchHomeSummary();
    const total = summary.subjects.reduce((n, s) => n + s.sessionsTotal, 0);
    if (!shouldAskStudyLength(total)) {
      try {
        window.localStorage.setItem(DONE_KEY, "1");
      } catch {
        // Storage blocked: counted again next time, which is harmless.
      }
    }
    return total;
  } catch {
    // Offline or old server: don't hold up the session over a question.
    return null;
  }
}

/** Whether to ask how long before this start. */
export async function studyLengthDue(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return shouldAskStudyLength(await existingSessions());
}

/** Where the slider starts: their last answer, else the session's own length (at least 15 minutes). */
export function initialStudyMinutes(defaultMinutes: number): number {
  const last = Number(readFlag(LAST_KEY));
  return clampStudyMinutes(Number.isFinite(last) && last > 0 ? last : Math.max(defaultMinutes, 15));
}

export function rememberStudyMinutes(minutes: number): void {
  try {
    window.localStorage.setItem(LAST_KEY, String(minutes));
  } catch {
    // Storage blocked: the slider just starts at the session's default next time.
  }
}
