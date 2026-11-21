"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  emptyProgress,
  progressStore,
  recordAnswer,
  resetTopic,
  type PracticeProgress,
} from "@/lib/notes-public/progress";

/**
 * One shared, localStorage-backed progress store for every practice card on
 * the page (the inline quick questions and the practice section), so the
 * running score is the same wherever a question was answered. The server
 * render (and the first client render) sees empty progress, so hydration
 * matches and stored answers appear right after.
 */

let state: PracticeProgress | null = null;
// This visit only (not stored): the run of correct answers and the question answered last.
let session: { streak: number; last: string | null } = { streak: 0, last: null };
const SERVER_SESSION = session;
const listeners = new Set<() => void>();
const SERVER = emptyProgress();

const load = () => (state ??= progressStore.read());
function set(next: PracticeProgress) {
  state = next;
  progressStore.write(next);
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith("scribe.notesPractice")) {
      state = progressStore.read();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePracticeProgress() {
  const progress = useSyncExternalStore(subscribe, load, () => SERVER);
  const answer = useCallback((key: string, questionId: string, choice: number, correct: boolean) => {
    const before = load();
    const next = recordAnswer(before, key, questionId, choice, correct, Date.now());
    if (next !== before) session = { streak: correct ? session.streak + 1 : 0, last: questionId };
    set(next);
  }, []);
  const reset = useCallback((key: string) => {
    session = { streak: 0, last: null };
    set(resetTopic(load(), key));
  }, []);
  const dismissPrompt = useCallback(() => set({ ...load(), promptDismissedAt: Date.now() }), []);
  const run = useSyncExternalStore(subscribe, () => session, () => SERVER_SESSION);
  return { progress, answer, reset, dismissPrompt, streak: run.streak, lastAnswered: run.last };
}
