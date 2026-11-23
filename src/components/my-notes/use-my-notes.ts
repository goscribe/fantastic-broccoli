"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { myNotesApi, myNotesAvailable, type OwnNoteSummary } from "@/lib/api/my-notes";
import { ownNoteHref, rememberNoteSubject } from "@/lib/my-notes";
import { emitTreeChanged, onTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";

/** Whether this server has "My notes". False until known, so nothing flashes in on an older deploy. */
export function useMyNotesAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void myNotesAvailable().then((ok) => !cancelled && setAvailable(ok));
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/**
 * The student's own notes: one subject's, or all of them. `available` is
 * false on a server without notes or when the call fails: callers then show
 * nothing about notes at all.
 */
export function useOwnNotes(workspaceId?: string) {
  const [notes, setNotes] = useState<OwnNoteSummary[]>([]);
  const [max, setMax] = useState(0);
  const [available, setAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => {
    myNotesAvailable()
      .then((ok) => (ok ? myNotesApi.list(workspaceId) : null))
      .then((out) => {
        setAvailable(!!out);
        setNotes(out?.notes ?? []);
        setMax(out?.max ?? 0);
      })
      .catch(() => setAvailable(false))
      .finally(() => setLoaded(true));
  }, [workspaceId]);
  useEffect(() => {
    load();
    return onTreeChanged(load);
  }, [load]);
  return { notes, max, available, loaded, reload: load };
}

/** "New note": makes an empty note in a subject and opens it in the editor. */
export function useNewNote() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const create = useCallback(
    async (workspaceId: string) => {
      if (creating) return;
      setCreating(true);
      try {
        const out = await myNotesApi.create({ workspaceId });
        rememberNoteSubject(workspaceId);
        emitTreeChanged();
        router.push(`${ownNoteHref(workspaceId, out.noteId)}?new=1`);
      } catch (err) {
        toastError(err, "Couldn't start a note");
        setCreating(false);
      }
    },
    [creating, router],
  );
  return { create, creating };
}
