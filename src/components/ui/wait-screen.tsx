"use client";

import { Check } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { cn } from "@/lib/utils";
import { useStartCheckRequest } from "@/lib/start-check-client";
import "@/app/design/design.css";

export interface WaitStep {
  label: string;
  state: "done" | "now" | "todo";
}

/**
 * The wait's progress bar: thin, in the accent, like every other progress in
 * the app (the quick check's stepper, the session's step bar). With a real
 * fraction the fill is that wide; without one a short piece slides across
 * (`.wait-bar--calm`, tokens.css).
 */
export function WaitBar({ pct, className }: { pct?: number; className?: string }) {
  const known = typeof pct === "number";
  const shown = known ? Math.max(0.04, Math.min(1, pct)) : 0;
  return (
    <div
      className={cn("wait-bar w-full [&>span]:bg-accent", !known && "wait-bar--calm", className)}
      {...(known ? { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(pct * 100), "aria-label": "Progress" } : { "aria-hidden": true })}
    >
      <span style={known ? { width: `${shown * 100}%` } : undefined} />
    </div>
  );
}

/**
 * The parts being made, as a quiet list: a small accent tick when done, an
 * accent ring on the one being worked on, a grey dot for the rest. Done and
 * pending labels are muted; only the current one is ink.
 */
export function WaitSteps({ steps, label, id, className }: { steps: WaitStep[]; label?: string; id?: string; className?: string }) {
  return (
    <ol id={id} className={cn("flex w-full flex-col gap-1.5 text-left", className)} aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={`${i}-${s.label}`}
          className={cn("life-rise flex items-start gap-2.5 text-small", s.state === "now" ? "font-semibold text-foreground" : s.state === "done" ? "text-muted-foreground" : "text-faint")}
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="grid h-[19px] w-4 shrink-0 place-items-center" aria-hidden>
            {s.state === "done" ? (
              <span className="grid size-4 place-items-center rounded-full bg-[var(--accent-tint,var(--muted))] text-accent">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
            ) : s.state === "now" ? (
              <span className="size-3.5 rounded-full border-2 border-accent motion-safe:animate-pulse" />
            ) : (
              <span className="size-1.5 rounded-full bg-border-strong" />
            )}
          </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {s.label}
            {s.state === "done" && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The one wait screen: every generator (a session, a Quick 5, a flashcard
 * deck, an audio episode, uploaded notes) shows the same thing while it works.
 *
 *   the cat · what is being made · what is happening now · one calm bar ·
 *   how long it takes
 *
 * It sits on the plain page with no card. `status` is the app's real state and
 * changes only when that does; `pct` is passed only where the server reports
 * progress, otherwise the bar just moves. `steps` lists real parts (the
 * session's activities) as they are finished. Nothing here advances on a timer.
 */
export function WaitScreen({
  pose = "pencil",
  title,
  status,
  time,
  pct,
  steps,
  stepsLabel,
  children,
  className,
  compact = false,
}: {
  pose?: MascotPose;
  /** What is being made: "Osmosis", "Your flashcards". */
  title: React.ReactNode;
  /** What is happening now, in a few words. */
  status?: React.ReactNode;
  /** How long it takes and what happens next, one line. */
  time?: React.ReactNode;
  /** 0..1 when the server reports real progress; leave out for the moving bar. */
  pct?: number;
  steps?: WaitStep[];
  stepsLabel?: string;
  children?: React.ReactNode;
  className?: string;
  /** Inside a dialog or a list: a smaller cat and less air. */
  compact?: boolean;
}) {
  // A start question (the confidence sheet) is open over this: the sheet comes first, the wait after it.
  const asking = useStartCheckRequest() !== null;
  return (
    <section className={cn("mx-auto flex w-full max-w-[440px] flex-col items-center text-center", compact ? "py-6" : "py-10 sm:py-14", asking && "invisible", className)} role="status" aria-live="polite">
      <Mascot key={pose} pose={pose} className={cn("cat-float", compact ? "h-[72px]" : "h-[96px] sm:h-[112px]")} />
      <h2 className={cn("text-balance font-extrabold leading-tight [overflow-wrap:anywhere]", compact ? "mt-4 text-[18px]" : "mt-5 text-[22px] sm:text-[24px]")}>{title}</h2>
      {status && <p className="mt-1.5 line-clamp-2 text-ui font-semibold text-muted-foreground">{status}</p>}
      <WaitBar pct={pct} className="mt-5 max-w-[280px]" />
      {time && <p className="mt-4 max-w-[360px] text-balance text-small text-muted-foreground">{time}</p>}
      {steps && steps.length > 0 && <WaitSteps steps={steps} label={stepsLabel} className="mt-6 max-w-[360px]" />}
      {children}
    </section>
  );
}
