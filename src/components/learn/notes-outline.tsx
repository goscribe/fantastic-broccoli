"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fetchNotesOutline, organizeNotes, type NotesOutline as Outline, type NotesTopic } from "@/lib/api/notes-outline";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Skeleton } from "@/components/ui/skeleton";
import type { Material } from "@/types";

/**
 * The subject's notes, regrouped by topic. "Organise notes" reads every processed file in the subject
 * and returns topics with their key points; each topic can start a study session on just that topic.
 */
export function NotesOutline({
  workspaceId,
  materials,
  starting,
  onStudy,
}: {
  workspaceId: string;
  materials: Material[];
  /** Title of the topic a session is being built for. */
  starting: string | null;
  onStudy: (topic: NotesTopic) => void;
}) {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNotesOutline(workspaceId)
      .then((o) => !cancelled && setOutline(o))
      .catch(() => !cancelled && setOutline(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const run = async () => {
    setWorking(true);
    try {
      const { outline: next, renamed } = await organizeNotes(workspaceId);
      setOutline(next);
      setOpen(next.topics[0]?.title ?? null);
      if (renamed > 0) emitTreeChanged();
      toast.success(
        `Organised into ${next.topics.length} topic${next.topics.length === 1 ? "" : "s"}` +
          (renamed > 0 ? ` · renamed ${renamed} file${renamed === 1 ? "" : "s"}` : ""),
      );
    } catch (e) {
      toastError(e, "Couldn't organise your notes");
    } finally {
      setWorking(false);
    }
  };

  if (materials.length === 0) return null;
  const titleOf = new Map(materials.map((m) => [m.id, m.title]));
  const stale = outline ? materials.length > outline.fileCount : false;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">
          Topics in your notes{outline ? <span className="font-medium text-faint"> · {outline.topics.length}</span> : null}
        </h2>
        {outline && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={working}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft disabled:opacity-60"
          >
            {working ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {working ? "Organising…" : stale ? "Update with new files" : "Reorganise"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : !outline ? (
        <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Notes all over the place?</div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Scribe reads every file in this subject and regroups it by topic, with the key points of each. Your files stay as they are.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={working}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60"
          >
            {working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {working ? "Reading your notes…" : "Organise my notes"}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {outline.topics.map((t, i) => {
              const expanded = open === t.title;
              return (
                <div key={t.title}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : t.title)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-[12px] font-bold text-accent">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{t.title}</span>
                      {t.summary && <span className={cn("block text-[12.5px] text-muted-foreground", !expanded && "truncate")}>{t.summary}</span>}
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 pl-[56px]">
                      <ul className="list-disc space-y-1.5 pl-4 text-[13.5px] leading-relaxed marker:text-faint">
                        {t.points.map((p, j) => (
                          <li key={j}>
                            <MarkdownText text={p} />
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onStudy(t)}
                          disabled={starting !== null}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[12.5px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60"
                        >
                          {starting === t.title ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" fill="currentColor" />}
                          Study this topic
                        </button>
                        {t.fileIds
                          .filter((id) => titleOf.has(id))
                          .map((id) => (
                            <span key={id} className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11.5px] font-medium text-muted-foreground">
                              <FileText className="size-3 shrink-0" />
                              <span className="truncate">{titleOf.get(id)}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Organised {formatRelativeDate(outline.generatedAt).toLowerCase()} from {outline.fileCount} file{outline.fileCount === 1 ? "" : "s"}
            {stale ? " · you’ve added files since" : ""}
          </p>
        </>
      )}
    </div>
  );
}
