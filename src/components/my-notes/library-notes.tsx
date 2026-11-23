"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet } from "@/components/notes-app/sheet";
import { buttonClass } from "@/components/ui/button";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import type { OwnNoteSummary } from "@/lib/api/my-notes";
import { defaultNoteSubject, lastNoteSubject } from "@/lib/my-notes";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";
import type { Folder, Workspace } from "@/types";
import { OwnNoteCard } from "./note-card";
import { useNewNote } from "./use-my-notes";

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  return [...root, ...folders.flatMap((f) => flatten(f.folders ?? [], f.workspaces ?? []))];
}

/**
 * "New note" from the Notes library: a note lives in a subject, so this asks
 * which one, with the subject last written in already picked.
 */
export function NewNoteDialog({ onClose }: { onClose: () => void }) {
  const [subjects, setSubjects] = useState<Workspace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const { create, creating } = useNewNote();
  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceTree()
      .then((tree) => {
        if (cancelled) return;
        // Notes are written in the student's own subjects (not ones shared with them).
        const own = flatten(tree.folders, tree.rootWorkspaces).filter((w) => !w.sharedBy);
        setSubjects(own);
        setPicked(defaultNoteSubject(own, lastNoteSubject())?.id ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Sheet
      title="New note"
      sub="Which subject is it for? Your note is kept there and used in its sessions."
      onClose={onClose}
      labelId="new-note-title"
      footer={
        subjects && subjects.length > 0 ? (
          <div className="flex justify-end">
            <button type="button" disabled={!picked || creating} aria-busy={creating} onClick={() => picked && void create(picked)} className={buttonClass({ variant: "primary", size: "md" })}>
              {creating && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Start writing
            </button>
          </div>
        ) : undefined
      }
    >
      {failed && <p className="py-4 text-ui text-muted-foreground">We couldn&apos;t load your subjects just now.</p>}
      {!failed && subjects === null && (
        <div className="flex flex-col gap-2 py-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}
      {subjects && subjects.length === 0 && (
        <p className="py-4 text-ui text-muted-foreground">
          You have no subjects yet.{" "}
          <Link href="/new-subject" className="font-bold text-accent hover:underline">
            Make a subject
          </Link>{" "}
          first, then write notes in it.
        </p>
      )}
      {subjects && subjects.length > 0 && (
        <ul role="radiogroup" aria-labelledby="new-note-title" className="flex flex-col gap-2 py-1">
          {subjects.map((w) => {
            const on = w.id === picked;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(w.id)}
                  className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left", on ? "border-foreground bg-muted" : "border-border hover:border-border-strong hover:bg-muted/50")}
                >
                  {/* The subject's own colour, as on its tile. */}
                  <span className="size-9 shrink-0 rounded-[10px]" style={{ background: "var(--tile-a)", ...(familyVars(resolveSubjectFamily(w.subjectFamily, w.title), w.id) as React.CSSProperties) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-ui font-bold">{w.title}</span>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-foreground" : "border-border-strong")} aria-hidden="true">
                    {on && <span className="size-2.5 rounded-full bg-foreground" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** The library's "Your notes": every note the student has written, grouped by its subject, most recently edited first. */
export function YourNotes({ notes, query }: { notes: OwnNoteSummary[]; query: string }) {
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { id: string; title: string; notes: OwnNoteSummary[] }>();
    for (const n of notes) {
      if (q && !`${n.title} ${n.workspaceTitle}`.toLowerCase().includes(q)) continue;
      const g = map.get(n.workspaceId) ?? { id: n.workspaceId, title: n.workspaceTitle, notes: [] };
      g.notes.push(n);
      map.set(n.workspaceId, g);
    }
    return [...map.values()];
  }, [notes, query]);
  if (groups.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="lib-your-notes">
      <h2 id="lib-your-notes" className="page-h2">
        Your notes
      </h2>
      {groups.map((g) => (
        <div key={g.id} className="mt-4">
          <h3 className="flex items-baseline gap-2 text-[15px] font-extrabold text-foreground">
            <Link href={`/workspace/${encodeURIComponent(g.id)}`} className="hover:text-accent">
              {g.title}
            </Link>
            <span className="text-small font-semibold text-faint">
              {g.notes.length} {g.notes.length === 1 ? "note" : "notes"}
            </span>
          </h3>
          <ul className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4">
            {g.notes.map((n) => (
              <li key={n.id} className="min-w-0">
                <OwnNoteCard note={n} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
