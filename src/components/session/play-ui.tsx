"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { SparkleBurst } from "@/components/graphics/sparkle-burst";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
export { runOfRight } from "@/lib/session-result";
import "@/lib/i18n/session";
import "@/lib/i18n/finish";
import "@/app/design/design.css";

/**
 * Shared pieces of the session player (redesign), so every activity type
 * looks like the quiz: content on the page, one chunky purple button, soft
 * pills for everything else, and no boxes inside boxes.
 */

/** The one main button of a step: the same chunky button as the quiz's "Check answer". */
export const playPrimary =
  "btn-chunky rounded-[var(--r-button)] h-[52px] w-full px-6 text-[16px] font-extrabold disabled:shadow-none sm:w-auto sm:min-w-[200px]";

/** The other choice beside it ("Didn't know", "Missed it"): a soft grey pill of the same height. */
export const playQuiet =
  "inline-flex h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-[var(--r-button)] bg-muted px-5 text-[15.5px] font-extrabold text-foreground transition-[background-color,transform] duration-150 hover:bg-[var(--edge)] active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 sm:w-auto sm:min-w-[150px]";

/** A place to type: a soft fill instead of an outlined box; a ring once focused. */
export const playField =
  "w-full resize-none rounded-[20px] bg-muted px-4 py-3.5 text-[16px] leading-relaxed text-foreground ring-inset transition-[background-color,box-shadow] duration-150 placeholder:text-faint focus:bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:text-muted-foreground motion-reduce:transition-none";

/** A quiet text action under the content ("Re-read", "Explain again"). */
export const playLink =
  "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

export function PlayPrimary({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="primary" size="lg" {...props} className={cn(playPrimary, className)} />;
}

/** The row that holds a step's buttons: stacked and full width on phones, right-aligned from sm up. */
export function PlayActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end", className)}>{children}</div>;
}

export type ItemState = "right" | "wrong" | "done" | "todo";

/**
 * Where you are inside an activity: one short bar per item, green for a right
 * answer, an open rose bar for one to come back to, the current one sheened.
 */
export function ItemDots({ states, current, className }: { states: ItemState[]; current?: number; className?: string }) {
  if (states.length < 2 || states.length > 24) return null;
  return (
    <div className={cn("flex w-24 shrink-0 gap-1 sm:w-32", className)} aria-hidden>
      {states.map((s, i) => (
        <span
          key={i}
          className={cn(
            "relative h-1.5 flex-1 overflow-hidden rounded-full transition-colors duration-300 motion-reduce:transition-none",
            s === "right" ? "bg-emerald-500" : s === "wrong" ? "bg-rose-300" : s === "done" ? "bg-accent" : i === current ? "bg-accent/40" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

/** "3 in a row": shown from the second right answer in a row; pops each time it grows. */
export function RunBadge({ run, className }: { run: number; className?: string }) {
  const { t } = useI18n();
  if (run < 2) return null;
  return (
    <span key={run} className={cn("life-tick inline-flex items-center gap-1 text-[13px] font-extrabold tabular-nums text-foreground", className)} style={{ ["--i" as string]: 0 }}>
      <Flame aria-hidden className="size-4 text-[var(--flame)]" fill="currentColor" strokeWidth={1.5} />
      {t("finish.inARow").replace("{n}", String(run))}
    </span>
  );
}

/** The round badge that says right or wrong: the tick draws itself, the cross just appears. */
export function MarkBadge({ ok, className }: { ok: boolean; className?: string }) {
  return (
    <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full text-white", ok ? "design-pop bg-emerald-600" : "bg-rose-600", className)}>
      {ok && <SparkleBurst burst={1} />}
      <svg viewBox="0 0 24 24" className={cn("size-6", ok && "play-tick")} fill="none" aria-hidden>
        <path d={ok ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"} stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * The end of one activity (deck finished, every term recalled, rewrite
 * accepted): the cat, a line, and the way on. No card around it.
 */
export function PlayDone({
  title,
  sub,
  pose = "cheer",
  action,
  onAction,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  pose?: MascotPose;
  action: ReactNode;
  onAction: () => void;
  /** Extra detail between the line and the button (a row of dots, feedback). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center sm:gap-6" role="status">
      <div className="relative shrink-0" aria-hidden>
        {pose === "cheer" && <SparkleBurst burst={1} count={10} distance={48} />}
        <Mascot pose={pose} className={cn("relative h-[104px] sm:h-[128px]", pose === "cheer" ? "cat-cheer" : "cat-peek")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="life-rise text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]">{title}</p>
        {sub && (
          <p className="life-rise mt-1 text-[15.5px] font-semibold leading-snug text-muted-foreground" style={{ ["--i" as string]: 1 }}>
            {sub}
          </p>
        )}
        {children && (
          <div className="life-rise mt-3" style={{ ["--i" as string]: 2 }}>
            {children}
          </div>
        )}
        <div className="life-rise mt-5" style={{ ["--i" as string]: 3 }}>
          <PlayPrimary onClick={onAction}>{action}</PlayPrimary>
        </div>
      </div>
    </div>
  );
}
