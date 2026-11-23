"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Lock, X } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { attachedNotesApi, type AttachedNote } from "@/lib/api/notes";
import { noteHref } from "@/lib/notes";
import { track } from "@/lib/funnel";
import { familyFor, familyVars } from "@/lib/subject-family";
import { onTreeChanged, emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { loadNoteCourses } from "./data";

/**
 * A subject's attached Scribe notes, by material id. `available` is false
 * when the server has no attached notes (an older deploy), the call fails, or
 * no course has a note yet: the subject page then shows its materials exactly
 * as before, with no "From Scribe notes".
 */
export function useAttachedNotes(workspaceId: string | undefined) {
  const [notes, setNotes] = useState<Map<string, AttachedNote>>(new Map());
  const [available, setAvailable] = useState(false);
  const load = useCallback(() => {
    if (!workspaceId) return;
    Promise.all([attachedNotesApi.list(workspaceId), loadNoteCourses()])
      .then(([rows, courses]) => {
        setNotes(new Map(rows.map((r) => [r.fileId, r])));
        // Nothing to add until some course has notes (a deploy before the notes are imported): no dead-end button.
        setAvailable(rows.length > 0 || courses.some((c) => c.noteCount > 0));
      })
      .catch(() => setAvailable(false));
  }, [workspaceId]);
  useEffect(() => {
    load();
    return onTreeChanged(load);
  }, [load]);
  return { notes, available, reload: load };
}

/**
 * An attached Scribe note in a subject's materials: a card like an upload's,
 * but in the course's colour with its topic code, labelled "Scribe note",
 * opening the in-app reader, and removable.
 */
export function NoteMaterialCard({
  note,
  workspaceId,
  selected,
  onToggle,
}: {
  note: AttachedNote;
  workspaceId: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const family = familyFor(note.courseTitle);
  const label = `${note.topicCode} ${note.topicName}`.trim();
  const href = `${noteHref(note.courseId, note.topicId)}?ws=${encodeURIComponent(workspaceId)}`;
  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await attachedNotesApi.detach(workspaceId, [note.fileId]);
      track("notes.detached", { from: "subject", noteCount: 1 }, workspaceId);
      emitTreeChanged();
      toast.success(`Removed ${label}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void attachedNotesApi
              .attach(workspaceId, note.courseId, [note.topicId])
              .then(() => emitTreeChanged())
              .catch(() => undefined);
          },
        },
      });
    } catch (err) {
      toastError(err, "Couldn't remove the note");
      setRemoving(false);
    }
  };
  const state = note.state === "locked" ? "Needs a plan" : note.state === "withdrawn" ? "Being revised" : null;
  return (
    <div data-note-material={note.fileId} className={cn("life-card relative flex min-w-0 flex-col p-2.5 transition-colors sm:p-3", selected && "border-accent ring-2 ring-accent/20", removing && "opacity-50")}>
      <label className="absolute left-[18px] top-[18px] z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-white shadow-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white">
        <input type="checkbox" className="peer sr-only" checked={selected} onChange={onToggle} aria-label={`Select ${label}`} />
        <Check className="size-3.5 opacity-0 peer-checked:opacity-100" />
      </label>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={removing}
        aria-label={`Remove ${label} from this subject`}
        title="Remove from this subject"
        className="absolute right-[18px] top-[18px] z-10 grid size-6 place-items-center rounded-md bg-white/90 text-muted-foreground shadow-sm hover:bg-white hover:text-foreground"
      >
        {removing ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" strokeWidth={2.5} />}
      </button>
      {/* The course's colour and art, as on its tile: at a glance this is Scribe's note, not an upload. */}
      <Link href={href} className={cn("subject-band relative block aspect-[4/3] w-full overflow-hidden !rounded-xl", note.state !== "current" && "opacity-60")} style={familyVars(family) as React.CSSProperties} aria-label={`Read ${label}`}>
        <SubjectArt family={family} className="!bottom-[-18%] !right-[-12%] !h-[92%]" />
        <span className="absolute bottom-2.5 left-3 right-3 block text-[22px] font-black leading-none text-white sm:text-[26px]">{note.topicCode}</span>
      </Link>
      <Link href={href} className="mt-2.5 block truncate px-1 text-ui font-semibold hover:text-accent" title={label}>
        {label}
      </Link>
      <div className="flex items-center gap-1 truncate px-1 pb-1 text-caption text-faint">
        {note.state === "locked" && <Lock className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
        <span className="truncate">
          Scribe note · {state ?? note.courseTitle}
        </span>
      </div>
    </div>
  );
}

/** "Add material" with its two ways in: upload files, or take Scribe's notes for a course. */
export function AddMaterialMenu({ uploading, onUpload, onNotes }: { uploading: boolean; onUpload: () => void; onNotes: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-muted";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={uploading}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft"
      >
        {uploading && <Loader2 className="size-3.5 animate-spin" />}
        Add material
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-30 w-[236px] rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onUpload();
            }}
          >
            <span className="text-ui font-bold">Upload files</span>
            <span className="text-caption text-faint">PDF, slides, photos of notes</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onNotes();
            }}
          >
            <span className="text-ui font-bold">From Scribe notes</span>
            <span className="text-caption text-faint">Our notes for your course</span>
          </button>
        </div>
      )}
    </div>
  );
}
