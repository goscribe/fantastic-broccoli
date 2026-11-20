"use client";

import "@/lib/i18n/today";
import "@/app/design/design.css";
import Link from "next/link";
import { Check, Flame, Layers, Snowflake, Sparkles } from "lucide-react";
import { Ring } from "@/components/design/charts";
import { Mascot } from "@/components/rewards/mascot";
import type { StreakSummary } from "@/lib/api/streak";
import { weekdayNames } from "@/lib/exam-planner-view";
import { useCountUp } from "@/lib/use-count-up";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FLAME = "#f97316";

/**
 * Home: the streak as something to protect — the number, a Mon–Sun strip of
 * the last 7 days (ticked, frozen, or today still open) and a ring for
 * today's goal. `tiles` adds the cards-due and points tiles under it (phones;
 * desktop keeps those in the sidebar).
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
    <div className={cn("flex flex-col gap-2.5", className)}>
      <section data-look="streak" className="relative overflow-hidden rounded-[24px] border border-[#ffdcbf] bg-[linear-gradient(150deg,#fff1e2_0%,#fff8f1_55%,#ffffff_100%)] p-4 shadow-[var(--card-shadow)]">
        <div className="flex items-center gap-3">
          {streak?.todayDone ? (
            <Mascot pose="flame" className="cat-bob -my-1 h-[60px]" />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(160deg,#fb923c,#f43f5e)] text-white shadow-[0_6px_14px_-6px_rgba(244,63,94,.6)]">
              <Flame className="size-6" fill="currentColor" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: FLAME }}>
              {shownStreak}
            </div>
            <div className="mt-1 truncate text-[13px] font-bold text-[#9a3412]">
              {streak?.todayDone ? t("today.streakSafe") : t("today.statStreak")}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            <span className="ring-draw">
              <Ring pct={today / goal} size={56} stroke={11} color={goalMet ? "#10b981" : "var(--accent)"}>
                {goalMet ? (
                  <Check className="size-5 text-emerald-600" strokeWidth={3} />
                ) : (
                  <span className="text-[11px] font-extrabold tabular-nums" aria-label={t("today.goalOf").replace("{a}", String(today)).replace("{b}", String(goal))}>
                    {today}/{goal}
                  </span>
                )}
              </Ring>
            </span>
            <span className="mt-1 text-[11px] font-bold text-muted-foreground">{goalMet ? t("today.goalMet") : t("today.dailyGoal")}</span>
          </div>
        </div>
        {week.length > 0 && (
          <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={t("today.dayStreakLong").replace("{n}", String(current))}>
            {week.map((d, i) => {
              const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
              const isToday = i === lastIdx;
              return (
                <li key={d.date} className="flex flex-col items-center gap-1">
                  <span className={cn("text-[11px] font-bold", isToday ? "text-[#c2410c]" : "text-muted-foreground")}>{names[dow]}</span>
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full",
                      d.done
                        ? "bg-[linear-gradient(160deg,#fb923c,#f97316)] text-white shadow-[0_2px_0_#c2410c]"
                        : d.frozen
                          ? "bg-sky-400 text-white"
                          : isToday
                            ? "border-2 border-dashed border-[#fb923c] bg-white"
                            : "bg-[#f3ece4]",
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
  const tile = "life-press relative flex min-h-[64px] items-center gap-3 rounded-[20px] border px-3.5 py-3 shadow-[var(--card-shadow)]";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Link href="/flashcards/review" className={cn(tile, "border-sky-100 bg-[linear-gradient(150deg,#e8f5ff,#ffffff)]")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500 text-white">
          <Layers className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[20px] font-extrabold leading-none tabular-nums">{shownDue}</span>
          <span className="mt-1 block truncate text-[12.5px] font-bold text-muted-foreground">{t("today.statCards")}</span>
        </span>
      </Link>
      <Link href="/shop" className={cn(tile, "border-accent/15 bg-[linear-gradient(150deg,#efeaff,#ffffff)]")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white">
          <Sparkles className="size-5" fill="currentColor" />
        </span>
        <span className="min-w-0">
          <span className="block text-[20px] font-extrabold leading-none tabular-nums">{shownPts}</span>
          <span className="mt-1 block truncate text-[12.5px] font-bold text-muted-foreground">{t("today.statPoints")}</span>
        </span>
        {canAfford && <span aria-label={t("rewards.homeAfford")} className="absolute right-3 top-3 size-2.5 rounded-full bg-accent ring-2 ring-white" />}
      </Link>
    </div>
  );
}
