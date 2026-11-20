"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, ChevronDown, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { getReading, recordSectionRead, setCurrentSection, useCurrentSection, useReading } from "./reading-store";

/**
 * Reading progress for a public note page, as progressive enhancement over
 * server HTML that already reads in full:
 * - a thin bar across the top of the screen and a ring / bar in the contents,
 *   driven by one CSS variable (no re-render while scrolling);
 * - a tick on each section once its end has been reached (kept in localStorage);
 * - things below the fold ease in as they arrive (only elements this script
 *   has marked are ever hidden, so nothing waits on JavaScript);
 * - "On this page": a sticky card beside the note on wide screens and a
 *   floating pill on phones. Both are plain anchor links (and the pill a
 *   <details>), so they work without JavaScript too.
 */

export interface RailEntry {
  /** Element id to jump to. */
  anchor: string;
  /** Section id for the read tick; none for the recall and practice entries. */
  sectionId?: string;
  kind: "section" | "recall" | "practice";
  label: ReactNode;
}

export function ReadingTracker({ topicKey, sectionIds, anchors }: { topicKey: string; sectionIds: string[]; anchors: string[] }) {
  const idsKey = sectionIds.join(",");
  const anchorsKey = anchors.join(",");
  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const root = document.documentElement;
    const article = document.getElementById("nl-article");
    const sectionEl = (id: string) => document.getElementById(`sec-${id}`);

    // Ticks from an earlier visit.
    for (const id of getReading().topics[topicKey]?.read ?? []) sectionEl(id)?.setAttribute("data-nl-read", "");

    const observers: IntersectionObserver[] = [];
    if (typeof IntersectionObserver !== "undefined") {
      // A section is read when its end marker is well inside the screen.
      const ends = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const section = (e.target as HTMLElement).closest("section[data-nl-section]") as HTMLElement | null;
            const id = section?.dataset.nlSection;
            if (!section || !id) continue;
            section.setAttribute("data-nl-read", "");
            recordSectionRead(topicKey, id, ids.length);
            ends.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -16% 0px" },
      );
      document.querySelectorAll(".nl-secend").forEach((el) => ends.observe(el));
      observers.push(ends);

      // Reveal on scroll, for what is below the fold right now.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        const reveal = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              (e.target as HTMLElement).dataset.nlReveal = "in";
              reveal.unobserve(e.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px" },
        );
        document.querySelectorAll<HTMLElement>("[data-nl-reveal]").forEach((el) => {
          if (el.dataset.nlReveal !== "" || el.getBoundingClientRect().top < window.innerHeight) return;
          el.dataset.nlReveal = "wait";
          reveal.observe(el);
        });
        observers.push(reveal);
      }
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      if (article) {
        const r = article.getBoundingClientRect();
        const span = Math.max(1, r.height - window.innerHeight * 0.6);
        root.style.setProperty("--nl-read", String(Math.min(1, Math.max(0, -r.top / span)).toFixed(4)));
      }
      let cur: string | null = null;
      for (const a of anchorsKey.split(",")) {
        const el = document.getElementById(a);
        if (el && el.getBoundingClientRect().top < 160) cur = a;
      }
      setCurrentSection(cur);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty("--nl-read");
      setCurrentSection(null);
    };
  }, [topicKey, idsKey, anchorsKey]);
  return (
    <div className="nl-topbar lg:hidden" aria-hidden="true">
      <span />
    </div>
  );
}

function useEntries(topicKey: string, entries: RailEntry[]) {
  const reading = useReading();
  const current = useCurrentSection();
  const read = new Set(reading.topics[topicKey]?.read ?? []);
  const sections = entries.filter((e) => e.kind === "section");
  const cur = entries.find((e) => e.anchor === current) ?? entries[0];
  return { read, cur, current, sections, readCount: sections.filter((e) => e.sectionId && read.has(e.sectionId)).length };
}

function Marker({ entry, n, read, active }: { entry: RailEntry; n: number; read: boolean; active: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-[7px] border-[1.5px] text-[12px] font-black transition-colors",
        read ? "border-accent bg-accent text-white" : active ? "border-foreground bg-card text-foreground" : "border-border-strong bg-card text-muted-foreground",
      )}
      aria-hidden="true"
    >
      {read ? <Check className="size-3.5" strokeWidth={3.5} /> : entry.kind === "section" ? n : <PencilLine className="size-3" strokeWidth={2.75} />}
    </span>
  );
}

/** Wide screens: a sticky card beside the note. */
export function ReadingRail({ topicKey, entries, footer }: { topicKey: string; entries: RailEntry[]; footer?: ReactNode }) {
  const { read, current, sections, readCount } = useEntries(topicKey, entries);
  return (
    <nav aria-label="On this page" className="nl-card sticky top-6 px-4 pb-4 pt-5">
      <div className="flex items-baseline justify-between px-2">
        <p className="text-[15px] font-extrabold">On this page</p>
        <p className="text-[12.5px] font-bold tabular-nums text-muted-foreground">
          {readCount}/{sections.length} read
        </p>
      </div>
      <div className="nl-railbar mx-2 mt-2.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span />
      </div>
      <ol className="mt-3 flex flex-col gap-0.5">
        {entries.map((e, i) => {
          const active = e.anchor === current;
          return (
            <li key={e.anchor}>
              <a
                href={`#${e.anchor}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-[var(--r-control)] px-2 py-2 text-[14px] leading-snug transition-colors",
                  active ? "bg-muted font-extrabold text-foreground" : "font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Marker entry={e} n={i + 1} read={!!e.sectionId && read.has(e.sectionId)} active={active} />
                <span className="min-w-0 flex-1 pt-px">{e.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
      {footer && <div className="mt-3 border-t border-[var(--edge)] px-1 pt-4">{footer}</div>}
    </nav>
  );
}

/** Phones: a floating pill naming the current section; opens the full list. */
export function ReadingPill({ topicKey, entries }: { topicKey: string; entries: RailEntry[] }) {
  const { read, cur, current, sections } = useEntries(topicKey, entries);
  const ref = useRef<HTMLDetailsElement>(null);
  const at = cur ? entries.indexOf(cur) : 0;
  return (
    <details ref={ref} className="group sticky top-2.5 z-20 lg:hidden">
      <summary className="nl-card flex h-[52px] cursor-pointer list-none items-center gap-2.5 !rounded-[var(--r-button)] pl-2.5 pr-4 !shadow-[0_6px_16px_-10px_rgba(29,26,22,0.35)] [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 36 36" className="nl-ring size-8 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--muted)" strokeWidth="4.2" />
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--accent)" strokeWidth="4.2" strokeLinecap="round" pathLength={100} />
        </svg>
        <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-muted-foreground">
          {cur?.kind === "section" ? `${at + 1}/${sections.length}` : "On this page"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{cur?.label}</span>
        <ChevronDown className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <ol className="nl-card nl-up absolute inset-x-0 top-full mt-2 flex max-h-[62vh] flex-col gap-0.5 overflow-y-auto p-2">
        {entries.map((e, i) => {
          const active = e.anchor === current;
          return (
            <li key={e.anchor}>
              <a
                href={`#${e.anchor}`}
                onClick={() => {
                  if (ref.current) ref.current.open = false;
                }}
                className={cn("flex min-h-11 items-center gap-2.5 rounded-[var(--r-control)] px-2.5 py-2 text-[15px] leading-snug", active ? "bg-muted font-extrabold" : "font-semibold")}
              >
                <Marker entry={e} n={i + 1} read={!!e.sectionId && read.has(e.sectionId)} active={active} />
                <span className="min-w-0 flex-1">{e.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
