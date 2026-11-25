"use client";

import { useSyncExternalStore } from "react";
import { emptyReading, markRead, readingStore, type ReadingProgress } from "@/lib/notes-public/reading";

/**
 * Shared, localStorage-backed reading progress (which sections of which topic
 * were read), plus the section the reader is in right now. The server render
 * and the first client render see empty progress, so hydration matches and
 * stored ticks appear right after.
 */

let state: ReadingProgress | null = null;
let current: string | null = null;
const listeners = new Set<() => void>();
const SERVER = emptyReading();

const load = () => (state ??= readingStore.read());
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function recordSectionRead(key: string, sectionId: string, total: number) {
  const next = markRead(load(), key, sectionId, total, Date.now());
  if (next === state) return;
  state = next;
  readingStore.write(next);
  emit();
}

export function setCurrentSection(id: string | null) {
  if (id === current) return;
  current = id;
  emit();
}

export const getReading = load;
export const useReading = () => useSyncExternalStore(subscribe, load, () => SERVER);
export const useCurrentSection = () => useSyncExternalStore(subscribe, () => current, () => null);

const noop = () => () => {};
/** False on the server and during hydration, true after: for things that only change once a script runs. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);
