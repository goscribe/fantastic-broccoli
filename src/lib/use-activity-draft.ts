"use client";

import { useEffect, useRef } from "react";
import { saveActivityDraft } from "@/lib/api/study";
import { saveActivityDraftKeepalive } from "@/lib/api/study-session";

const DEBOUNCE_MS = 1500;

/** Bank-pulled extension activities aren't persisted server-side. */
const isDraftable = (activityId: string) => !activityId.startsWith("bank-");

/**
 * Latest in-progress state per activity for the current page. The session
 * page's server data is only fetched once, so when the learner navigates
 * between activities the remounted component would otherwise restore from a
 * stale server draft and appear to have lost their answers.
 */
const memoryDrafts = new Map<string, Record<string, unknown>>();

/** Freshest known draft for an activity: in-memory first, then server. */
export function restoredDraft(
  activityId: string,
  serverDraft?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return memoryDrafts.get(activityId) ?? serverDraft;
}

/**
 * Debounced server autosave of in-progress activity state (answers, step
 * position, etc.). Also flushes on unmount and page unload so a refresh or
 * tab close doesn't lose work. Restore by seeding component state from
 * `activity.draft`.
 */
export function useActivityDraft(
  activityId: string,
  draft: Record<string, unknown>,
) {
  const latest = useRef(draft);
  const lastSaved = useRef<string | null>(null);
  const serialized = JSON.stringify(draft);

  useEffect(() => {
    latest.current = draft;
    memoryDrafts.set(activityId, draft);
  });

  useEffect(() => {
    if (!isDraftable(activityId)) return;
    // First render reflects the restored draft — nothing new to save.
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = serialized;
      saveActivityDraft(activityId, latest.current).catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [activityId, serialized]);

  useEffect(() => {
    if (!isDraftable(activityId)) return;
    const flush = () => {
      const current = JSON.stringify(latest.current);
      if (lastSaved.current === null || current === lastSaved.current) return;
      lastSaved.current = current;
      saveActivityDraftKeepalive(activityId, latest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [activityId]);
}

/**
 * Saves an activity's latest in-progress state now (not after the debounce),
 * so the server sees an answer the learner has just given — the copilot's
 * "Why?" checks that the question was answered before explaining it.
 * Resolves after `timeoutMs` at the latest.
 */
export function flushActivityDraft(activityId: string, timeoutMs = 2500): Promise<void> {
  const draft = memoryDrafts.get(activityId);
  if (!draft || !isDraftable(activityId)) return Promise.resolve();
  const save = saveActivityDraft(activityId, draft).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([save, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
