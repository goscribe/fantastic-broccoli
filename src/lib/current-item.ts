"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Which question/card/step each activity currently shows. Activity
 * components publish their position; the session page reads it so the
 * copilot can be told exactly what's on screen.
 */
const positions = new Map<string, number>();
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useReportCurrentItem(activityId: string, index: number) {
  useEffect(() => {
    if (positions.get(activityId) === index) return;
    positions.set(activityId, index);
    listeners.forEach((fn) => fn());
  }, [activityId, index]);
}

export function useCurrentItemIndex(activityId?: string): number | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (activityId ? positions.get(activityId) : undefined),
    () => undefined,
  );
}
