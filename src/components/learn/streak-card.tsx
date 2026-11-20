"use client";

import "@/lib/i18n/today";
import "@/app/design/design.css";
import Link from "next/link";
import { Check, ChevronRight, Flame, Snowflake } from "lucide-react";
import { Ring } from "@/components/design/charts";
import { Mascot } from "@/components/rewards/mascot";
import type { StreakSummary } from "@/lib/api/streak";
import { weekdayNames } from "@/lib/exam-planner-view";
import { useCountUp } from "@/lib/use-count-up";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Home: the streak as one simple row to protect — a flame and the number,
 * today's goal ring, and a Mon–Sun strip of the last 7 days (ticked, frozen,
 * or today still open). Orange is the mascot's, used for the flame and ticks
 * only. `tiles` adds the cards-due and points tiles under it (phones; desktop
 * keeps those in the sidebar).
 */
export function StreakCard({
  streak,
  due,
  points,
  canAfford = false,
  tiles = false,
  className,
}: {
  streak: StreakSummary | null;
  due?: number | null;
  points?: number | null;
  canAfford?: boolean;
  tiles?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const names = weekdayNames(locale, "narrow");
  const current = streak?.current ?? 0;
  const shownStreak = useCountUp(current);
  const goal = Math.max(1, streak?.goalMin ?? 20);
  const today = Math.min(goal, streak?.todayMinutes ?? 0);
  const goalMet = !!streak?.todayGoalMet || today >= goal;
  const week = streak?.week ?? [];
  const lastIdx = week.length - 1;

  return (
    <div className={cn("life-rise flex flex-col gap-3", className)} style={{ ["--i" as string]: 1 }}>
      <section data-look="streak" className="life-card px-5 pb-5 pt-4">
        <div className="flex items-center gap-2.5">
          {streak?.todayDone ? (
            <Mascot pose="flame" className="cat-bob -my-1 h-[52px]" />
          ) : (
            <Flame className={cn("size-8 shrink-0", current > 0 ? "text-[var(--flame)]" : "text-border-strong")} fill="currentColor" strokeWidth={1.5} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-extrabold leading-none tabular-nums">{shownStreak}</span>
              <span className="truncate text-[14px] font-bold text-muted-foreground">
                {t("today.statStreak")}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-right text-[12px] font-bold leading-tight text-muted-foreground">
              {goalMet ? t("today.goalMet") : t("today.dailyGoal")}
              {!goalMet && (
                <span className="block text-[13px] font-extrabold tabular-nums text-foreground" aria-label={t("today.goalOf").replace("{a}", String(today)).replace("{b}", String(goal))}>
                  {today}/{goal}
                </span>
              )}
            </span>
            <span className="ring-draw">
              <Ring pct={today / goal} size={40} stroke={14} color="var(--accent)">
                {goalMet && <Check className="size-4 text-accent" strokeWidth={3.5} />}
              </Ring>
            </span>
          </div>
        </div>
        {week.length > 0 && (
          <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={t("today.dayStreakLong").replace("{n}", String(current))}>
            {week.map((d, i) => {
              const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
              const isToday = i === lastIdx;
              return (
                <li key={d.date} className="flex flex-col items-center gap-1.5">
                  <span className={cn("text-[11.5px] font-bold", isToday ? "text-foreground" : "text-muted-foreground")}>{names[dow]}</span>
                  <span
                    style={{ ["--i" as string]: i }}
                    className={cn(
                      "grid size-9 place-items-center rounded-full lg:size-8",
                      d.done
                        ? "life-tick bg-[var(--flame)] text-[var(--flame-ink)] shadow-[0_2px_0_var(--flame-edge)]"
                        : d.frozen
                          ? "bg-muted text-muted-foreground"
                          : isToday
                            ? "border-2 border-dashed border-[var(--flame)] bg-card"
                            : "bg-muted",
                    )}
                  >
                    {d.done ? <Check className="size-4" strokeWidth={3.5} /> : d.frozen ? <Snowflake className="size-4" /> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {tiles && <StatTiles due={due ?? 0} points={points ?? 0} canAfford={canAfford} />}
    </div>
  );
}

function StatTiles({ due, points, canAfford }: { due: number; points: number; canAfford: boolean }) {
  const { t } = useI18n();
  const shownDue = useCountUp(due);
  const shownPts = useCountUp(points);
  // One card, two figures split by a hairline: a number, its label, nothing else.
  const cell = "life-press relative flex min-h-[72px] flex-col justify-center px-5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50";
  const label = "mt-1.5 flex items-center gap-1 truncate text-[13px] font-bold text-muted-foreground";
  return (
    <div className="life-card grid grid-cols-2 divide-x divide-border overflow-hidden">
      <Link href="/flashcards/review" className={cell}>
        <span className="block text-[22px] font-extrabold leading-none tabular-nums">{shownDue}</span>
        <span className={label}>
          {t("today.statCards")}
          <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={2.5} />
        </span>
      </Link>
      <Link href="/shop" className={cell}>
        <span className="block text-[22px] font-extrabold leading-none tabular-nums">{shownPts}</span>
        <span className={label}>
          {t("today.statPoints")}
          <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={2.5} />
        </span>
        {canAfford && <span aria-label={t("rewards.homeAfford")} className="absolute right-4 top-4 size-2 rounded-full bg-accent" />}
      </Link>
    </div>
  );
}
