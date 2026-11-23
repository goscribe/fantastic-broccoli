"use client";

/**
 * Browser side of the "How long do you want to study?" question.
 * `chooseStudyLength(input)` is awaited right before a session is generated:
 * on the learner's first and second session it opens <StudyLengthHost/>'s
 * sheet and returns the input with their answer applied; otherwise, or when
 * they close the sheet, it returns the input as is. It never cancels the
 * start: some callers have already uploaded files or made the subject.
 */
import { useSyncExternalStore } from "react";
import { fetchHomeSummary } from "@/lib/api/home";
import { applyStudyLength, clampStudyMinutes, shouldAskStudyLength, type StudyLengthInput } from "@/lib/study-length";

/** Set once the learner has two sessions, so later starts skip the count. */
const DONE_KEY = "scribe.study-length.done";
/** Their last answer, the slider's starting point next time. */
const LAST_KEY = "scribe.study-length.last";

interface Pending {
  initial: number;
  resolve: (minutes: number | null) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useStudyLengthRequest(): Pending | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
    () => null,
  );
}

/** Called by the sheet with the chosen minutes, or null when closed. */
export function answerStudyLength(minutes: number | null): void {
  const p = pending;
  if (!p) return;
  pending = null;
  notify();
  if (minutes != null) {
    try {
      window.localStorage.setItem(LAST_KEY, String(minutes));
    } catch {
      // Storage blocked: the slider just starts at the session's default next time.
    }
  }
  p.resolve(minutes);
}

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

export async function chooseStudyLength<T extends StudyLengthInput>(input: T): Promise<T> {
  if (typeof window === "undefined") return input;
  if (!shouldAskStudyLength(await existingSessions())) return input;
  // One question at a time: a second start while it is open settles the first with its defaults.
  if (pending) pending.resolve(null);
  const last = Number(readFlag(LAST_KEY));
  const initial = clampStudyMinutes(Number.isFinite(last) && last > 0 ? last : Math.max(input.durationMinutes, 15));
  const minutes = await new Promise<number | null>((resolve) => {
    pending = { initial, resolve };
    notify();
  });
  return minutes == null ? input : applyStudyLength(input, minutes);
}
