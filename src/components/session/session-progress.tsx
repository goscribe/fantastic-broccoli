"use client";

import { ArrowRight } from "lucide-react";
import { MathText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/rewards";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";
import type { SessionActivity } from "@/types";

/** How long the reward card stays before the next activity opens on its own. */
export const REWARD_MS = 1400;

const isDone = (a: SessionActivity) =>
  a.status === "completed" || a.status === "skipped";

/** Minutes left in a plan: the estimates of every activity not yet done. */
export function remainingMinutes(activities: SessionActivity[]): number {
  const left = activities.filter((a) => !isDone(a));
  if (left.length === 0) return 0;
  return Math.max(
    1,
    Math.round(left.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0)),
  );
}

/** "Step 2 of 5 · ~4 min left": the words that go with SessionStepBar. */
export function SessionStepLabel({
  activities,
  activeIndex,
  className,
}: {
  activities: SessionActivity[];
  /** Index of the open activity; `activities.length` on the debrief. */
  activeIndex: number;
  className?: string;
}) {
  const { t } = useI18n();
  const total = activities.length;
  const minutes = remainingMinutes(activities);
  const onDebrief = activeIndex >= total;
  // On the summary screen its own title says it's done; the full bar is enough here.
  // A one-activity session (a Quick 5) has no steps to count: just the time left.
  const single = total <= 1;
  const label = onDebrief
    ? "\u00a0"
    : single
      ? ""
      : t("session.stepOf")
        .replace("{n}", String(activeIndex + 1))
        .replace("{total}", String(total));
  return (
    <p
      className={cn("flex min-w-0 items-baseline gap-1.5 text-small font-semibold leading-none tabular-nums", className)}
      aria-live="polite"
    >
      {label && <span className="shrink-0 text-foreground">{label}</span>}
      {!onDebrief && minutes > 0 && (
        <>
          {label && (
            <span className="text-faint" aria-hidden>
              ·
            </span>
          )}
          <span className="truncate text-muted-foreground">
            {t("session.minLeft").replace("{n}", String(minutes))}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * The session's segmented bar: one segment per activity, done ones filled,
 * the current one highlighted; segments are tappable to jump around the plan.
 * It fills its container, so put it in the same column as the content under
 * it and the two share their left and right edges.
 */
export function SessionStepBar({
  activities,
  activeIndex,
  onSelect,
  className,
}: {
  activities: SessionActivity[];
  activeIndex: number;
  onSelect?: (index: number) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const dense = activities.length > 16;
  return (
    <ol
      aria-label={t("session.progressLabel")}
      className={cn("flex items-center", dense ? "gap-[3px]" : "gap-1", className)}
    >
      {activities.map((activity, i) => {
        const current = i === activeIndex;
        const done = activity.status === "completed";
        const skipped = activity.status === "skipped";
        return (
          <li key={activity.id} className="flex min-w-0 flex-1">
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(i)}
              aria-current={current ? "step" : undefined}
              aria-label={`${t("session.activityWord")} ${i + 1}: ${activity.title}`}
              title={activity.title}
              className="group flex w-full min-w-0 py-1.5 disabled:cursor-default"
            >
              {/* The track; a finished step fills in from the left, the step you are on carries a slow sheen. */}
              <span className={cn("relative block h-2.5 w-full overflow-hidden rounded-full bg-border", !done && !current && !skipped && "group-hover:bg-border-strong")}>
                {done ? (
                  <span key="done" className="play-fill absolute inset-0 rounded-full bg-accent" />
                ) : skipped ? (
                  <span className="absolute inset-0 bg-accent/30" />
                ) : current ? (
                  <span className="play-sheen absolute inset-0 bg-accent/35" />
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export interface ActivityReward {
  /** The activity just completed (still on screen behind the card). */
  fromId: string;
  next?: SessionActivity;
  /** Activities still not done after this one. */
  remaining: number;
  /** Points this activity earned (server-derived; shown for momentum). */
  pts: number;
  /** Session-completion points this finish earns / the next finish would. */
  bonusPts: number;
}

/**
 * The quick reward after finishing an activity: a check, "Nice — 3 to go"
 * and a one-tap "Next: <title> · ~3 min" button. Non-blocking — it opens the
 * next activity by itself after REWARD_MS.
 */
export function ActivityRewardCard({
  reward,
  onNext,
  className,
}: {
  reward: ActivityReward;
  onNext: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { next, remaining, pts, bonusPts } = reward;
  const allDone = remaining === 0;
  const message = allDone
    ? t("session.rewardAllDone")
    : remaining === 1
      ? t("session.rewardOneToGo")
      : t("session.rewardToGo").replace("{n}", String(remaining));
  const pill = pts > 0 ? t("rewards.plusPts").replace("{n}", String(pts)) : null;
  const bonusLine =
    bonusPts > 0 && allDone
      ? t("rewards.sessionBonus").replace("{n}", String(bonusPts))
      : bonusPts > 0 && remaining === 1
        ? t("rewards.finishBonusHint").replace("{n}", String(bonusPts))
        : null;

  return (
    <div
      role="status"
      className={cn(
        "animate-reward-in pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[22px] bg-card p-3 shadow-[0_12px_32px_-12px_rgba(29,26,22,0.4)] ring-1 ring-black/5",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-1">
        <span className="animate-check-pop grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-check-draw"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ui font-bold leading-tight">{message}</p>
          {bonusLine && (
            <p className="mt-0.5 text-caption font-medium leading-tight text-muted-foreground">
              {bonusLine}
            </p>
          )}
        </div>
        {pill && (
          <span className="animate-pts-rise shrink-0 text-small font-extrabold tabular-nums text-foreground">{pill}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-2.5 flex h-11 w-full items-center gap-2 rounded-full bg-accent px-4 text-left text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
      >
        {next ? (
          <>
            <span className="shrink-0 opacity-80">{t("session.nextUp")}</span>
            <span className="min-w-0 truncate">
              <MathText text={next.title} />
            </span>
            {next.estimatedMinutes > 0 && (
              <span className="shrink-0 font-medium opacity-80">
                · {t("session.approxMin").replace("{n}", String(Math.round(next.estimatedMinutes)))}
              </span>
            )}
          </>
        ) : (
          <span className="min-w-0 truncate">{t("session.seeResults")}</span>
        )}
        <ArrowRight className="ml-auto size-4 shrink-0" />
      </button>
      <span
        aria-hidden
        className="animate-reward-countdown absolute inset-x-0 bottom-0 h-[3px] bg-accent/40"
        style={{ ["--reward-ms" as string]: `${REWARD_MS}ms` }}
      />
    </div>
  );
}
