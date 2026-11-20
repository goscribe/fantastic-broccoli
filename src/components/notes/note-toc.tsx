"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TopicNoteContent } from "@/lib/api/notes";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/notes";

/** Sections of a note as contents entries, plus the recall questions. */
function entries(note: TopicNoteContent, recallLabel: string) {
  return [
    ...note.sections.map((s, i) => ({ id: `sec-${s.id}`, label: s.heading, n: i + 1 })),
    ...(note.recall.length ? [{ id: "sec-recall", label: recallLabel, n: 0 }] : []),
  ];
}

/** Which entry the reader is in: the last heading scrolled past the top band. */
function useCurrent(ids: string[]) {
  const [current, setCurrent] = useState(ids[0]);
  const key = ids.join(",");
  useEffect(() => {
    const ids = key.split(",");
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      () => {
        let cur = ids[0];
        for (const el of els) if (el.getBoundingClientRect().top < 140) cur = el.id;
        setCurrent(cur);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: [0, 1] },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [key]);
  return current;
}

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * "On this page": on phones a sticky bar naming the current section that
 * opens the full list; on wide screens a sticky rail beside the note.
 */
export function NoteToc({ note, variant }: { note: TopicNoteContent; variant: "bar" | "rail" }) {
  const { t } = useI18n();
  const list = entries(note, t("notes.recallHeading"));
  const ids = list.map((e) => e.id);
  const current = useCurrent(ids);
  const [open, setOpen] = useState(false);
  const cur = list.find((e) => e.id === current) ?? list[0];

  if (variant === "rail")
    return (
      <nav aria-label={t("notes.onThisPage")} className="sticky top-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-faint">{t("notes.onThisPage")}</p>
        <ol className="mt-2 flex flex-col gap-0.5 border-l border-border">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => go(e.id)}
                className={cn(
                  "-ml-px block w-full border-l-2 py-1.5 pl-3 text-left text-[13px] leading-snug",
                  e.id === current ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {e.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    );

  return (
    <nav aria-label={t("notes.onThisPage")} className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-left"
      >
        <span className="shrink-0 text-[12px] font-semibold text-faint">{t("notes.onThisPage")}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{cur?.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="flex max-h-[60vh] flex-col overflow-y-auto pb-2">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  go(e.id);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-[14px] leading-snug",
                  e.id === current ? "font-semibold text-accent" : "text-foreground",
                )}
              >
                <span className="w-5 shrink-0 tabular-nums text-faint">{e.n || ""}</span>
                {e.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
