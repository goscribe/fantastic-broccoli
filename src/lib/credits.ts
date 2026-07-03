"use client";

import { useSyncExternalStore } from "react";

/** Credits earned for completing study sessions. Persisted locally in demo
 * mode; a live backend would track this server-side. */

const STORAGE_KEY = "scribe-credits";
const AWARDED_KEY = "scribe-credits-awarded";
export const SESSION_COMPLETION_CREDITS = 25;

const listeners = new Set<() => void>();

function read(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const value = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(value) ? value : 120;
}

function emit() {
  for (const listener of listeners) listener();
}

export function getCredits(): number {
  return read();
}

/** Awards credits once per session. Returns the amount granted; a session
 * awarded within the last few minutes still reports its amount so the
 * completion banner survives re-renders, while older awards return 0. */
export function awardSessionCredits(sessionId: string): number {
  if (typeof window === "undefined") return 0;
  const awardedRaw = window.localStorage.getItem(AWARDED_KEY);
  const awarded: Record<string, number> = awardedRaw
    ? JSON.parse(awardedRaw)
    : {};
  const previous = awarded[sessionId];
  if (previous !== undefined) {
    return Date.now() - previous < 5 * 60 * 1000
      ? SESSION_COMPLETION_CREDITS
      : 0;
  }
  awarded[sessionId] = Date.now();
  window.localStorage.setItem(AWARDED_KEY, JSON.stringify(awarded));
  window.localStorage.setItem(
    STORAGE_KEY,
    String(read() + SESSION_COMPLETION_CREDITS),
  );
  setTimeout(emit, 0);
  return SESSION_COMPLETION_CREDITS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCredits(): number {
  return useSyncExternalStore(subscribe, read, () => 0);
}
