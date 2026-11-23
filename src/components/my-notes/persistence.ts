"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isConflict, myNotesApi } from "@/lib/api/my-notes";

/**
 * How a note's document reaches the server, behind one small interface so
 * the editor screen does not know. Today it is `versionedAutosave`: the
 * whole document, saved a moment after typing stops, with a version check.
 * Live shared editing replaces it with a provider that syncs a Yjs document
 * (and passes its Collaboration extension to the editor's `extensions`); the
 * screen keeps calling `changed` / `flush` and reading `state`, or ignores
 * them, and nothing else moves.
 */
export interface NotePersistence {
  /** The document or the title changed; `doc` is the editor JSON (omit when only the title did). */
  changed(next: { title?: string; content?: unknown }): void;
  /** Send what is pending now (leaving the page). */
  flush(final?: boolean): Promise<void>;
  dispose(): void;
}

export type SaveState = "saved" | "saving" | "offline" | "conflict";

interface Pending {
  title?: string;
  content?: unknown;
}

/** Whole-document autosave against `myNotes.save`. */
export function versionedAutosave(noteId: string, baseVersion: number, onState: (s: SaveState, savedAt?: Date) => void, delayMs = 1200): NotePersistence {
  let version = baseVersion;
  let pending: Pending | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let stopped = false;

  const send = async (final: boolean): Promise<void> => {
    if (running) await running;
    if (!pending || stopped) return;
    const batch = pending;
    pending = null;
    onState("saving");
    running = (async () => {
      try {
        const out = await myNotesApi.save({ noteId, baseVersion: version, ...batch, ...(final ? { final: true } : {}) }, final ? { keepalive: true } : undefined);
        version = out.version;
        if (!pending) onState("saved", new Date(out.updatedAt));
      } catch (err) {
        if (isConflict(err)) {
          stopped = true;
          onState("conflict");
          return;
        }
        // Keep what was not saved (newer edits win) and try again on the next change or when back online.
        pending = { ...batch, ...(pending ?? {}) };
        onState("offline");
      }
    })();
    await running;
    running = null;
  };

  const online = () => void send(false);
  if (typeof window !== "undefined") window.addEventListener("online", online);

  return {
    changed(next) {
      if (stopped) return;
      pending = { ...(pending ?? {}), ...next };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void send(false), delayMs);
    },
    async flush(final = false) {
      if (timer) clearTimeout(timer);
      timer = null;
      // Nothing pending on the way out still tells the server the editor closed, so the note is indexed now.
      if (final && !pending && !stopped) pending = {};
      await send(final);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      if (typeof window !== "undefined") window.removeEventListener("online", online);
    },
  };
}

/** The autosave for one loaded note, flushed when the tab is hidden or the screen is left. */
export function useNotePersistence(noteId: string, baseVersion: number | null) {
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const ref = useRef<NotePersistence | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (baseVersion === null) return;
    const p = versionedAutosave(noteId, baseVersion, (s, at) => {
      setState(s);
      if (at) setSavedAt(at);
      if (s === "saved") dirty.current = false;
    });
    ref.current = p;
    const hidden = () => {
      if (document.visibilityState === "hidden") void p.flush(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", hidden);
      void p.flush(true);
      p.dispose();
      ref.current = null;
    };
  }, [noteId, baseVersion]);
  const changed = useCallback((next: { title?: string; content?: unknown }) => {
    dirty.current = true;
    ref.current?.changed(next);
  }, []);
  const flush = useCallback(() => ref.current?.flush() ?? Promise.resolve(), []);
  return { state, savedAt, changed, flush };
}
