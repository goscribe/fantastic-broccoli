"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { WaitBar, WaitScreen, WaitSteps, type WaitStep } from "@/components/ui/wait-screen";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/proficiency";
import { cn } from "@/lib/utils";

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
  /** One quiet line under the bar (how long it takes, or that it is taking longer). */
  hint?: string;
  /** "What happens next", shown while there is no plan yet (an upload being read). */
  nextSteps?: WaitStep[];
  nextLabel?: string;
  /**
   * Something to do is on screen under this (the quick check, the warm-up,
   * the confidence question): the build shrinks to a header (small cat,
   * title, thin bar, one status line) and its steps fold behind "7 steps".
   */
  compact?: boolean;
}

/**
 * The session being built, on the shared wait screen: the cat at work, the
 * server's own status line and progress, and the session's activities ticking
 * off as each one is written. Everything shown comes from the server's
 * progress events; nothing advances on a timer.
 */
export function BuildStage({ title, pct, label, stageIndex, planned, finished = [], writing = false, hint, nextSteps, nextLabel, compact = false }: BuildStageProps) {
  const done = new Set(finished);
  const current = writing && planned ? planned.findIndex((a) => !done.has(a.title)) : -1;
  const pose = STAGE_POSE[Math.min(stageIndex, STAGE_POSE.length - 1)];
  const stepsLabel = planned?.length ? `${planned.length} activities planned` : nextLabel;
  const steps: WaitStep[] | undefined = planned?.length
    ? planned.map((a, i) => ({ label: a.title, state: done.has(a.title) ? "done" : i === current ? "now" : "todo" }))
    : nextSteps;
  if (compact) return <BuildHeader pose={pose} title={title} pct={pct} label={label} hint={hint} steps={steps} stepsLabel={stepsLabel} />;
  return <WaitScreen className="!pt-4" pose={pose} title={title} status={label} pct={pct} time={hint} stepsLabel={stepsLabel} steps={steps} />;
}

/** The build as a header over the quick check: one row with the cat, the bar and the status, the steps folded away. */
function BuildHeader({ pose, title, pct, label, hint, steps, stepsLabel }: { pose: MascotPose; title: string; pct: number; label: string; hint?: string; steps?: WaitStep[]; stepsLabel?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <section className="w-full text-left" role="status" aria-live="polite">
      <div className="flex items-center gap-3.5">
        <Mascot key={pose} pose={pose} className="h-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-ui font-extrabold leading-tight">{title}</h2>
          <WaitBar pct={pct} className="mt-2" />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-small text-muted-foreground">{label}</p>
            {steps && steps.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((o) => !o)}
                className="-my-2 -mr-2 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-small font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {open ? t("prof.buildStepsHide") : t("prof.buildSteps").replace("{count}", String(steps.length))}
                <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
      {open && steps && <WaitSteps id={listId} steps={steps} label={stepsLabel} className="mt-3 sm:pl-[62px]" />}
      {hint && <p className="mt-2 text-caption text-faint sm:pl-[62px]">{hint}</p>}
    </section>
  );
}
