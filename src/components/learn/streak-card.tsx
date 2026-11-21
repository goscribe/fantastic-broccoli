"use client";

import "@/lib/i18n/today";
import "@/app/design/design.css";
import Link from "next/link";
import { Check, ChevronRight, Flame, Snowflake } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import type { StreakSummary } from "@/lib/api/streak";
import { weekdayNames } from "@/lib/exam-planner-view";
import { useCountUp } from "@/lib/use-count-up";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Home: the streak as one simple row to protect — a flame and the number,
 * whether today counts yet, and a Mon–Sun strip of the last 7 days (ticked,
 * frozen, or today still open). A streak day is one finished activity, so
 * that is what the card asks for; minutes studied today are shown only as
 * information (there is no minutes goal to meet). Orange is the mascot's,
 * used for the flame and ticks only. `tiles` adds the cards-due and points
 * tiles under it (phones; desktop keeps those in the rail).
 */
export function StreakCard({
  streak,
  due,
  points,
  canAfford = false,
  tiles = false,
  className,
}: {
  streak: StreakSummary | null | undefined;
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
  const done = !!streak?.todayDone;
  const minutes = Math.max(0, Math.round(streak?.todayMinutes ?? 0));
  const week = streak?.week ?? [];
  const lastIdx = week.length - 1;

  return (
    <div className={cn("life-rise flex flex-col gap-3", className)} style={{ ["--i" as string]: 1 }}>
      <section data-look="streak" className="life-card px-5 pb-5 pt-4">
        <div className="flex items-center gap-2.5">
          {done ? (
            <Mascot pose="flame" className="cat-bob -my-1 h-[52px]" />
          ) : (
            <Flame className={cn("size-8 shrink-0", current > 0 ? "text-[var(--flame)]" : "text-border-strong")} fill="currentColor" strokeWidth={1.5} />
          )}
          <div className="flex min-w-0 shrink-0 items-baseline gap-1.5">
            <span className="text-[26px] font-extrabold leading-none tabular-nums">{shownStreak}</span>
            <span className="truncate text-ui font-bold text-muted-foreground">{t("today.statStreak")}</span>
          </div>
          {streak && (
            <span className="ml-auto min-w-0 text-right text-caption font-bold leading-tight text-muted-foreground">
              {done ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <Check className="size-3.5 text-[var(--flame-edge)]" strokeWidth={3.5} />
                  {t("streak.doneToday")}
                </span>
              ) : (
                <span className="block text-foreground">{t("streak.keepIt")}</span>
              )}
              {minutes > 0 && <span className="mt-0.5 block font-semibold">{t("streak.minutesToday").replace("{m}", String(minutes))}</span>}
            </span>
          )}
        </div>
        {week.length > 0 && (
          <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={t("today.dayStreakLong").replace("{n}", String(current))}>
            {week.map((d, i) => {
              const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
              const isToday = i === lastIdx;
              return (
                <li key={d.date} className="flex flex-col items-center gap-1.5">
                  <span className={cn("text-caption font-bold", isToday ? "text-foreground" : "text-muted-foreground")}>{names[dow]}</span>
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
