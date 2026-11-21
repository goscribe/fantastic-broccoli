"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

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

/**
 * How the player's bottom bar moves within an activity that has several
 * questions (or steps). An activity registers its own Back/Next while it is
 * on screen; the bar uses them before moving between activities.
 */
export interface ItemNav {
  canNext: () => boolean;
  canBack: () => boolean;
  next: () => void;
  back: () => void;
}

const navs = new Map<string, ItemNav>();

export function useItemNav(activityId: string, nav: ItemNav) {
  const latest = useRef(nav);
  useEffect(() => {
    latest.current = nav;
  });
  useEffect(() => {
    const proxy: ItemNav = {
      canNext: () => latest.current.canNext(),
      canBack: () => latest.current.canBack(),
      next: () => latest.current.next(),
      back: () => latest.current.back(),
    };
    navs.set(activityId, proxy);
    return () => {
      if (navs.get(activityId) === proxy) navs.delete(activityId);
    };
  }, [activityId]);
}

export function getItemNav(activityId?: string): ItemNav | undefined {
  return activityId ? navs.get(activityId) : undefined;
}
