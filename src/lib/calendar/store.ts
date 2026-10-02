"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CalendarEvent, CalendarEventKind } from "./ics";
import { DEFAULT_PLAN_PREFS, type PlanPrefs, type PlannedSession } from "./planner";

/**
 * The imported calendar and study plan, kept in this browser and scoped to
 * the signed-in account (one localStorage key per user id). Nothing here is
 * sent to the server; analytics only ever see counts and kinds.
 */

export type CalendarImportMethod = "ics_file" | "sample";

export interface AcceptedSession extends PlannedSession {
  workspaceId?: string;
  acceptedAt: string;
  /** Set once the learner starts it from Scribe. */
  openedAt?: string;
  /** True when the learner changed Scribe's suggested time. */
  edited: boolean;
}

export interface ImportedCalendar {
  version: 1;
  importedAt: string;
  method: CalendarImportMethod;
  fileCount: number;
  calendarNames: string[];
  horizonDays: number;
  events: CalendarEvent[];
  /** Learner corrections to the inferred kind, per recurring series. */
  kindOverrides: Record<string, CalendarEventKind>;
  /** Exams/deadlines the learner chose not to plan for. */
  excludedTargets: string[];
  prefs: PlanPrefs;
  /** Changes to the suggested plan before it's accepted. */
  edits: { removed: string[]; starts: Record<string, string> };
  /** Workspace per exam/deadline; "" = learner cleared the suggestion. */
  workspaceByTarget: Record<string, string>;
  accepted: AcceptedSession[];
}

const KEY_PREFIX = "scribe_calendar_v1:";
const listeners = new Set<() => void>();

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

function readRaw(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

function parse(raw: string | null): ImportedCalendar | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImportedCalendar;
    if (parsed?.version !== 1 || !Array.isArray(parsed.events)) return null;
    return {
      ...parsed,
      prefs: { ...DEFAULT_PLAN_PREFS, ...parsed.prefs },
      edits: parsed.edits ?? { removed: [], starts: {} },
      kindOverrides: parsed.kindOverrides ?? {},
      excludedTargets: parsed.excludedTargets ?? [],
      workspaceByTarget: parsed.workspaceByTarget ?? {},
      accepted: parsed.accepted ?? [],
    };
  } catch {
    return null;
  }
}

function write(userId: string, value: ImportedCalendar | null): void {
  try {
    if (value) localStorage.setItem(keyFor(userId), JSON.stringify(value));
    else localStorage.removeItem(keyFor(userId));
  } catch {
    // Storage full or blocked: the import only lives for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(KEY_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getImportedCalendar(userId: string): ImportedCalendar | null {
  return parse(readRaw(userId));
}

export function saveImportedCalendar(userId: string, value: ImportedCalendar): void {
  write(userId, value);
}

export function clearImportedCalendar(userId: string): void {
  write(userId, null);
}

export function updateImportedCalendar(
  userId: string,
  fn: (current: ImportedCalendar) => ImportedCalendar,
): void {
  const current = getImportedCalendar(userId);
  if (current) write(userId, fn(current));
}

/** Live imported calendar for the signed-in user (null until imported). */
export function useImportedCalendar(userId: string | undefined): {
  calendar: ImportedCalendar | null;
  update: (fn: (current: ImportedCalendar) => ImportedCalendar) => void;
} {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(userId),
    () => null,
  );
  const calendar = useMemo(() => parse(raw), [raw]);
  const update = useCallback(
    (fn: (current: ImportedCalendar) => ImportedCalendar) => {
      if (userId) updateImportedCalendar(userId, fn);
    },
    [userId],
  );
  return { calendar, update };
}

export function markPlannedSessionOpened(
  userId: string,
  sessionId: string,
): AcceptedSession | undefined {
  const session = getImportedCalendar(userId)?.accepted.find((s) => s.id === sessionId);
  if (!session) return undefined;
  if (!session.openedAt) {
    updateImportedCalendar(userId, (c) => ({
      ...c,
      accepted: c.accepted.map((s) =>
        s.id === sessionId ? { ...s, openedAt: new Date().toISOString() } : s,
      ),
    }));
  }
  return session;
}

/** Where a planned session starts: the workspace's session wizard, pre-filled. */
export function plannedSessionLink(
  session: Pick<AcceptedSession, "id" | "workspaceId">,
  src: string,
): string {
  if (!session.workspaceId) return "/calendar";
  const params = new URLSearchParams({ create: "1", planned: session.id, src });
  return `/workspace/${session.workspaceId}/study?${params.toString()}`;
}

/** Sessions to surface on home: one happening now, else the next upcoming. */
export function nextPlannedSession(
  accepted: AcceptedSession[],
  now = Date.now(),
): { session: AcceptedSession; isNow: boolean } | undefined {
  const open = accepted
    .filter((s) => !s.openedAt && Date.parse(s.end) + 60 * 60_000 > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const first = open[0];
  if (!first) return undefined;
  return { session: first, isNow: Date.parse(first.start) - 15 * 60_000 <= now };
}
