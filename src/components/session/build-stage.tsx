"use client";

import { type MascotPose } from "@/components/rewards/mascot";
import { WaitScreen, type WaitStep } from "@/components/ui/wait-screen";

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
}

/**
 * The session being built, on the shared wait screen: the cat at work, the
 * server's own status line and progress, and the session's activities ticking
 * off as each one is written. Everything shown comes from the server's
 * progress events; nothing advances on a timer.
 */
export function BuildStage({ title, pct, label, stageIndex, planned, finished = [], writing = false, hint, nextSteps, nextLabel }: BuildStageProps) {
  const done = new Set(finished);
  const current = writing && planned ? planned.findIndex((a) => !done.has(a.title)) : -1;
  return (
    <WaitScreen
      className="!pt-4"
      pose={STAGE_POSE[Math.min(stageIndex, STAGE_POSE.length - 1)]}
      title={title}
      status={label}
      pct={pct}
      time={hint}
      stepsLabel={planned?.length ? `${planned.length} activities planned` : nextLabel}
      steps={
        planned?.length
          ? planned.map((a, i) => ({ label: a.title, state: done.has(a.title) ? "done" : i === current ? "now" : "todo" }))
          : nextSteps
      }
    />
  );
}
