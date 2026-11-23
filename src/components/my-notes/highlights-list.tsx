"use client";

import { X } from "lucide-react";
import { Sheet } from "@/components/notes-app/sheet";
import type { HighlightColor } from "@/lib/api/my-notes";
import { HIGHLIGHT_COLORS, quotePreview } from "@/lib/my-notes";

export interface HighlightItem {
  key: string;
  text: string;
  color: HighlightColor;
  /** Its words are no longer in the note (the note was corrected): listed so it can be removed, not jumped to. */
  missing?: boolean;
}

const colorVar = (c: HighlightColor) => HIGHLIGHT_COLORS.find((x) => x.id === c)?.var ?? "--hl-yellow";

/**
 * "Highlights": every passage the reader marked in this note, in reading
 * order. Tapping one jumps to it; each can be removed. Used for Scribe notes
 * (highlights kept on the server) and a student's own notes (marks in the
 * document) alike.
 */
export function HighlightsSheet({ items, onJump, onRemove, onClose }: { items: HighlightItem[]; onJump: (key: string) => void; onRemove: (key: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Highlights" sub={items.length ? undefined : "Select any text in the note and pick a colour."} onClose={onClose} labelId="highlights-title">
      {items.length === 0 ? (
        <p className="py-6 text-ui text-muted-foreground">Nothing highlighted yet.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((h) => (
            <li key={h.key} className="flex items-start gap-1 border-b border-border last:border-b-0">
              <button
                type="button"
                disabled={h.missing}
                onClick={() => {
                  onJump(h.key);
                  onClose();
                }}
                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 py-3 text-left disabled:opacity-60"
              >
                <span className="mt-1 h-[1.1em] w-1.5 shrink-0 rounded-full" style={{ background: `var(${colorVar(h.color)})`, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-ui text-foreground">{quotePreview(h.text, 180)}</span>
                  {h.missing && <span className="mt-0.5 block text-caption text-muted-foreground">This part of the note has changed</span>}
                </span>
              </button>
              <button type="button" onClick={() => onRemove(h.key)} aria-label={`Remove highlight: ${quotePreview(h.text, 40)}`} title="Remove" className="mt-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
