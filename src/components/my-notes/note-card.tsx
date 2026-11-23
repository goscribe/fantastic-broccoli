"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { OwnNoteSummary } from "@/lib/api/my-notes";
import { ownNoteHref } from "@/lib/my-notes";
import { cn, formatRelativeDate } from "@/lib/utils";
import "./my-notes.css";

/**
 * A student's own note among a subject's materials: a card like an upload's,
 * but a sheet of ruled paper with the note's title on it, marked "Your note"
 * with when it was last edited and that it is private. Opens the editor.
 * Selectable for a session like any material once it has a material row.
 */
export function OwnNoteCard({ note, selected, onToggle }: { note: OwnNoteSummary; selected?: boolean; onToggle?: () => void }) {
  const href = ownNoteHref(note.workspaceId, note.id);
  const edited = formatRelativeDate(note.updatedAt);
  return (
    <div data-own-note-card={note.id} data-file-id={note.fileId ?? undefined} className={cn("life-card relative flex min-w-0 flex-col p-2.5 transition-colors sm:p-3", selected && "border-accent ring-2 ring-accent/20")}>
      {note.fileId && onToggle && (
        <label className="absolute left-[18px] top-[18px] z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-white shadow-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white">
          <input type="checkbox" className="peer sr-only" checked={!!selected} onChange={onToggle} aria-label={`Select ${note.title}`} />
          <Check className="size-3.5 opacity-0 peer-checked:opacity-100" />
        </label>
      )}
      <Link href={href} className="own-note-paper relative block aspect-[4/3] w-full overflow-hidden rounded-xl" aria-label={`Open ${note.title}`}>
        <span className="own-note-paper-head" aria-hidden="true" />
        <span className={cn("absolute right-3 top-0 flex h-9 items-center text-caption font-bold text-muted-foreground", note.fileId && onToggle ? "left-11" : "left-3")}>Your note</span>
        <span className="absolute inset-x-3.5 top-[46px] line-clamp-2 text-[15px] font-extrabold leading-[22px] text-foreground sm:inset-x-4 sm:line-clamp-3 sm:text-[17px]">{note.title}</span>
      </Link>
      <Link href={href} className="mt-2.5 block truncate px-1 text-ui font-semibold hover:text-accent" title={note.title}>
        {note.title}
      </Link>
      <div className="truncate px-1 pb-1 text-caption text-faint" title="Only you can see this note">
        Private · {edited === "Today" ? "Edited today" : `Edited ${edited.toLowerCase()}`}
      </div>
    </div>
  );
}
