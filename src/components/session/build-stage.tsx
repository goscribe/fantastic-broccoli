"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";

/** Activity art by type (lower-case API types), the same props the session list uses. */
const ACTIVITY_ART: Record<string, string> = {
  reading: "/design/props/books.png",
  comprehension_check: "/design/props/bulb.png",
  mcq: "/design/props/notes.png",
  flashcard_review: "/design/props/cards.png",
  worksheet: "/design/props/pencil.png",
  interactive: "/design/props/bulb.png",
  vocab_recall: "/design/props/cards.png",
  cloze: "/design/props/notes.png",
  explain_aloud: "/design/props/flag.png",
};

/** What the cat is doing at each stage (gathering, outlining, writing, verifying, finishing). */
const STAGE_POSE: MascotPose[] = ["book", "think", "pencil", "think", "cheer"];

export interface BuildStageProps {
  title: string;
  /** 0..1, from the server's progress events. */
  pct: number;
  /** The stage label, or the live detail ("Writing activity 2 of 5 — …"). */
  label: string;
  stageIndex: number;
  stageCount: number;
  /** The planned activities, once the outline exists; leave out where there is no plan to show (first-run upload). */
  planned?: { title: string; type: string }[];
  /** Titles of the activities already written. */
  finished?: string[];
  /** Writing has started (stage index of "generating" or later). */
  writing?: boolean;
  /** One quiet line at the foot of the panel (how long it takes, or that it is taking longer). */
  hint?: string;
}

/**
 * The session being built, as something to watch: the cat at work, a real
 * progress bar, and the session's activities appearing as the outline lands
 * and ticking off as each one is written. Everything shown comes from the
 * server's progress events; nothing advances on a timer.
 */
export function BuildStage({ title, pct, label, stageIndex, stageCount, planned, finished = [], writing = false, hint }: BuildStageProps) {
  const pose = STAGE_POSE[Math.min(stageIndex, STAGE_POSE.length - 1)];
  const done = new Set(finished);
  const current = writing && planned ? planned.findIndex((a) => !done.has(a.title)) : -1;
  const shown = Math.max(0.04, Math.min(1, pct));

  return (
    <section className="w-full" aria-label={`Building ${title}`}>
      <div className="relative overflow-hidden rounded-[var(--r-panel,24px)] bg-[color-mix(in_oklab,var(--accent)_9%,var(--card))] px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        {/* Soft glow behind the cat. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-56 rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] blur-2xl" />
        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-wide text-accent">
              Building · step {Math.min(stageIndex + 1, stageCount)} of {stageCount}
            </p>
            <h2 className="mt-1.5 text-balance text-[22px] font-extrabold leading-[1.15] sm:text-[26px]">{title}</h2>
            <p key={label} className="life-rise mt-2 line-clamp-2 text-[14px] font-semibold text-muted-foreground" aria-live="polite">
              {label}
            </p>
          </div>
          <Mascot key={pose} pose={pose} className="life-rise cat-float size-[84px] shrink-0 sm:size-[108px]" />
        </div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Session build progress">
          <div className="build-stage__fill h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${shown * 100}%` }} />
        </div>

        {/* The session taking shape: chips appear with the outline and tick off as each activity is written. */}
        {planned && (
        <ul className="relative mt-4 flex flex-wrap gap-2" aria-label={planned.length ? `${planned.length} activities planned` : "Planning your activities"}>
          {planned.length === 0
            ? [96, 128, 84].map((w, i) => (
                <li key={i} className="flex h-9 items-center gap-2 rounded-full bg-card/80 pl-1.5 pr-3">
                  <span className="skeleton size-6 rounded-full" />
                  <span className="skeleton h-2.5 rounded-full" style={{ width: w }} />
                </li>
              ))
            : planned.map((a, i) => {
                const isDone = done.has(a.title);
                const isCurrent = i === current;
                return (
                  <li
                    key={`${i}-${a.title}`}
                    className={cn(
                      "life-rise flex h-9 max-w-full items-center gap-2 rounded-full bg-card pl-1.5 pr-3 text-[13px] font-semibold shadow-[0_1px_0_rgb(0_0_0/0.05)]",
                      isCurrent && "ring-2 ring-accent/40",
                      !isDone && !isCurrent && "bg-card/60 text-muted-foreground",
                    )}
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    {isDone ? (
                      <span className="life-tick flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-label="Written">
                        <Check className="size-3.5" strokeWidth={3.2} />
                      </span>
                    ) : (
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted", isCurrent && "cat-float")}>
                        <Image src={ACTIVITY_ART[a.type.toLowerCase()] ?? "/design/props/notes.png"} alt="" width={20} height={20} className="size-4 object-contain" />
                      </span>
                    )}
                    <span className="min-w-0 truncate">{a.title}</span>
                  </li>
                );
              })}
        </ul>
        )}
        {hint && <p className="relative mt-4 text-[12.5px] leading-snug text-muted-foreground">{hint}</p>}
      </div>
    </section>
  );
}
