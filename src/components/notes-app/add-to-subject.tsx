"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { attachedNotesApi, type AttachSkipReason, type NoteSubjects } from "@/lib/api/notes";
import { coursesApi } from "@/lib/api/courses";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { isPlanLimitError } from "@/lib/api/plan-limit";
import { paywallHref } from "@/lib/notes-public/gate";
import { track } from "@/lib/funnel";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import type { Folder, Workspace } from "@/types";
import { Sheet } from "./sheet";

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  const out = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      out.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return out;
}

export const SKIP_MESSAGE: Record<AttachSkipReason, string> = {
  already_attached: "That note is already in this subject.",
  limit: "This subject is full of Scribe notes. Remove one to add another.",
  locked: "That note is included with a plan or exam pass.",
  no_note: "Scribe has no note for that topic yet.",
  unknown_topic: "We couldn't find that topic.",
};

/**
 * "Add to a subject" on a note: pick one of the student's subjects (or make
 * the course's subject) and the note becomes material there. A reference to
 * the note, so it does not use an upload slot and corrections flow through.
 */
export function AddToSubjectDialog({
  courseId,
  courseTitle,
  topicId,
  topicLabel,
  onClose,
  onChanged,
}: {
  courseId: string;
  courseTitle: string;
  topicId: string;
  /** "A1.1 Water" */
  topicLabel: string;
  onClose: () => void;
  /** The note was added somewhere (the reader updates its button). */
  onChanged?: (workspaceIds: string[]) => void;
}) {
  const [subjects, setSubjects] = useState<Workspace[] | null>(null);
  const [where, setWhere] = useState<NoteSubjects | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchWorkspaceTree(), attachedNotesApi.subjectsFor(courseId, topicId)])
      .then(([tree, w]) => {
        if (cancelled) return;
        setSubjects(flatten(tree.folders, tree.rootWorkspaces));
        setWhere(w);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [courseId, topicId]);

  const attachedIds = useMemo(() => new Set(where?.attachedWorkspaceIds ?? []), [where]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (subjects ?? []).filter((w) => !q || w.title.toLowerCase().includes(q));
    // The course's own subject first, then subjects that already hold the note, then the rest as the sidebar has them.
    const rank = (w: Workspace) => (w.id === where?.courseWorkspaceId ? 0 : attachedIds.has(w.id) ? 1 : 2);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [subjects, query, where, attachedIds]);

  const mark = (workspaceId: string) => {
    const next = [...new Set([...(where?.attachedWorkspaceIds ?? []), workspaceId])];
    setWhere((w) => (w ? { ...w, attachedWorkspaceIds: next } : w));
    onChanged?.(next);
  };

  const add = async (workspaceId: string, title: string) => {
    if (busy) return;
    setBusy(workspaceId);
    try {
      const out = await attachedNotesApi.attach(workspaceId, courseId, [topicId]);
      const skipped = out.skipped[0]?.reason;
      if (out.attached.length || skipped === "already_attached") {
        mark(workspaceId);
        if (out.attached.length) {
          track("notes.attached", { from: "note", noteCount: 1, courseId }, workspaceId);
          emitTreeChanged();
          toast.success(`Added to ${title}`);
        }
      } else if (skipped) toast.error(SKIP_MESSAGE[skipped]);
    } catch (err) {
      if (isPlanLimitError(err)) window.location.href = paywallHref(courseId, topicId);
      else toastError(err, "Couldn't add the note");
    } finally {
      setBusy(null);
    }
  };

  /** No subject for this course yet: make it (named after the course) with the note in it. */
  const addToNew = async () => {
    if (busy) return;
    setBusy("new");
    try {
      const { workspaceId } = await coursesApi.enroll(courseId);
      emitTreeChanged();
      const tree = await fetchWorkspaceTree().catch(() => null);
      if (tree) setSubjects(flatten(tree.folders, tree.rootWorkspaces));
      setWhere((w) => (w ? { ...w, courseWorkspaceId: workspaceId } : w));
      setBusy(null);
      await add(workspaceId, courseTitle);
    } catch (err) {
      setBusy(null);
      toastError(err, "Couldn't make the subject");
    }
  };

  const blocked = where && !where.attachable ? where.reason : null;
  return (
    <Sheet
      title={`Add ${topicLabel} to a subject`}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="h-10 shrink-0 rounded-xl bg-muted px-5 text-[14.5px] font-bold hover:bg-border">
            Done
          </button>
        </div>
      }
    >
      {failed && <p className="py-6 text-center text-[14.5px] text-muted-foreground">Adding notes to a subject isn&apos;t available right now. Please try again later.</p>}
      {!failed && !subjects && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}
      {!failed && subjects && blocked && (
        <p className="rounded-2xl bg-muted px-4 py-3.5 text-[14.5px] leading-snug text-foreground">
          {blocked === "locked" ? (
            <>
              This note is included with a plan or exam pass, so it can&apos;t be added as material yet.{" "}
              <a href={paywallHref(courseId, topicId)} className="font-bold text-accent hover:underline">
                See plans
              </a>
            </>
          ) : (
            "Scribe has no note for this topic yet, so there is nothing to add."
          )}
        </p>
      )}
      {!failed && subjects && !blocked && (
        <>
          {subjects.length > 8 && (
            <label className="mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-muted px-3.5">
              <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
              <span className="sr-only">Search your subjects</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your subjects" className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold placeholder:font-medium placeholder:text-faint focus:outline-none" />
            </label>
          )}
          <ul className="flex flex-col gap-2">
            {!where?.courseWorkspaceId && !query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => void addToNew()}
                  disabled={!!busy}
                  className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border px-3.5 py-2.5 text-left hover:border-border-strong hover:bg-muted/40 disabled:opacity-60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">{busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">New subject: {courseTitle}</span>
                    <span className="block text-[12.5px] text-faint">Starts with this note in it</span>
                  </span>
                </button>
              </li>
            )}
            {shown.map((w) => {
              const added = attachedIds.has(w.id);
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    // A subject that already holds the note: the row goes to it.
                    onClick={() => (added ? router.push(`/workspace/${w.id}`) : void add(w.id, w.title))}
                    disabled={!!busy}
                    className="life-card flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:border-border-strong disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-[15px] font-bold leading-snug">{w.title}</span>
                      <span className="block text-[12.5px] text-faint">
                        {w.id === where?.courseWorkspaceId ? `Your ${courseTitle} subject · ` : ""}
                        {w.materials.length} material{w.materials.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    {busy === w.id ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
                    ) : added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-muted-foreground">
                        <Check className="size-4" strokeWidth={3} /> Open
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-bold text-white">Add</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && query.trim() && <p className="py-6 text-center text-[14px] text-muted-foreground">No subject matches “{query.trim()}”.</p>}
        </>
      )}
    </Sheet>
  );
}
