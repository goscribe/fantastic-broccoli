"use client";

import { buttonClass } from "@/components/ui/button";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Flame, Snowflake, Sparkles } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { useRewards, useStreak, type StreakSummary } from "@/lib/rewards";
import { toast } from "@/lib/toast";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/rewards";
import "@/lib/i18n/purpose";
import { freezeSaveLine } from "@/lib/api/streak";

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

function weekdayLabel(date: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    );
  } catch {
    return "";
  }
}

/** The 7-day strip: done (flame), frozen (ice), missed, and today (outlined until it counts). */
export function StreakWeek({ streak }: { streak: StreakSummary }) {
  const { t, locale } = useI18n();
  const lastIndex = streak.week.length - 1;
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {streak.week.map((day, i) => {
        const today = i === lastIndex;
        const state = day.done ? "done" : day.frozen ? "frozen" : today ? "today" : "missed";
        const label =
          state === "done"
            ? t("rewards.dayDone")
            : state === "frozen"
              ? t("rewards.dayFrozen")
              : state === "today"
                ? t("rewards.dayToday")
                : t("rewards.dayMissed");
        return (
          <li key={day.date} className="flex flex-col items-center gap-1" aria-label={`${day.date}: ${label}`} title={label}>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full",
                state === "done" && "bg-[#f0a645] text-[#3a2420]",
                state === "frozen" && "bg-muted text-muted-foreground ring-1 ring-border-strong",
                state === "missed" && "bg-muted text-faint",
                state === "today" && "border-2 border-dashed border-[#f0a645] text-[#b26a0c]",
              )}
            >
              {state === "done" ? (
                <Flame className="size-4" fill="currentColor" strokeWidth={1.5} />
              ) : state === "frozen" ? (
                <Snowflake className="size-4" strokeWidth={2.2} />
              ) : state === "today" ? (
                <Flame className="size-4" strokeWidth={2} />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={cn("text-[11px] font-semibold leading-none", today ? "text-foreground" : "text-faint")}>
              {weekdayLabel(day.date, locale)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FreezeIcons({ held, max }: { held: number; max: number }) {
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: Math.max(max, held) }, (_, i) => (
        <span
          key={i}
          className={cn(
            "grid size-7 place-items-center rounded-full",
            i < held ? "bg-sky-100 text-sky-600 ring-1 ring-sky-300" : "border border-dashed border-border-strong text-faint",
          )}
        >
          <Snowflake className="size-3.5" strokeWidth={2.2} />
        </span>
      ))}
    </span>
  );
}

/**
 * Header streak pill: flame + days, lit once today counts and outlined while
 * it doesn't. Opens a popover with the week, freezes, points and the shop.
 */
export function StreakButton({ variant = "new" }: { variant?: "new" | "legacy" }) {
  const { t } = useI18n();
  const { data: streak } = useStreak();
  const { data: rewards } = useRewards();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!streak?.todayDone || !MILESTONES.includes(streak.current)) return;
    const key = `streak-celebrated-${streak.current}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    toast.success(`${t("rewards.streakDays").replace("{n}", String(streak.current))}!`);
  }, [streak, t]);

  // A freeze Scribe applied by itself: one calm line, once per save, on the next visit.
  useEffect(() => {
    const save = streak?.freezeSave;
    const line = freezeSaveLine(save, t);
    if (!save || !line) return;
    const key = `scribe.freezeSave.${save.at}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    toast(line, { duration: 8000 });
  }, [streak?.freezeSave, t]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!streak) return null;
  const lit = streak.todayDone;
  const days = streak.current;
  const title = (lit ? t("rewards.streakDoneTitle") : t("rewards.streakPendingTitle")).replace("{n}", String(days));
  const status = lit ? t("rewards.todayDone") : days > 0 ? t("rewards.keepIt") : t("rewards.startIt");
  const freezes = rewards?.freezes ?? streak.freezes;
  const maxFreezes = rewards?.maxFreezes ?? 2;

  return (
    <div className="relative z-40" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={title}
        title={title}
        className={cn(
          "flex items-center gap-1 font-bold tabular-nums transition-colors",
          variant === "new" ? "h-10 rounded-xl border px-2.5 text-[14px] sm:px-3" : "rounded-full border px-2 py-1 text-[12px]",
          variant === "new"
            ? "border-border bg-white text-foreground hover:bg-muted"
            : lit
              ? "border-[#fdba74] bg-[#fff4e6] text-[#c2410c] hover:bg-[#ffedd5]"
              : "border-border bg-white text-muted-foreground hover:bg-muted dark:bg-card",
        )}
      >
        {/* The flame is always orange in the new UI; filled once there is a streak, brighter when today counts. */}
        <Flame
          className={cn(
            variant === "new" ? "size-[19px]" : "size-3.5",
            variant === "new" ? "text-[var(--flame)]" : lit ? "text-[#f97316]" : "text-faint",
            variant === "new" && lit && "life-pop",
          )}
          fill={lit || (variant === "new" && days > 0) ? "currentColor" : "none"}
          fillOpacity={variant === "new" && !lit ? 0.35 : 1}
          strokeWidth={lit ? 1.6 : 2}
        />
        {days}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("rewards.streakDays").replace("{n}", String(days))}
          className="fixed inset-x-3 top-[64px] z-50 rounded-2xl border border-border bg-card p-4 text-foreground shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] animate-fade-up sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]"
        >
          <div className="flex items-center gap-3">
            <Mascot pose="flame" className="h-[60px]" />
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-bold leading-tight">
                {t("rewards.streakDays").replace("{n}", String(days))}
              </p>
              <p className={cn("mt-1 text-[13px] font-medium leading-snug", lit ? "text-muted-foreground" : "text-[#c2410c]")}>
                {status}
              </p>
              {streak.longest > days && (
                <p className="mt-0.5 text-[12px] text-faint">{t("rewards.best").replace("{n}", String(streak.longest))}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <StreakWeek streak={streak} />
          </div>

          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{t("rewards.freezes")}</p>
                <p className="text-[11.5px] leading-snug text-faint">{t("rewards.freezeHint")}</p>
              </div>
              <FreezeIcons held={freezes} max={maxFreezes} />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{t("rewards.points")}</p>
                <p className="text-[11.5px] leading-snug text-faint">{t("rewards.howToEarn")}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[15px] font-bold tabular-nums">
                <Sparkles className="size-4 text-accent" fill="currentColor" />
                {rewards ? rewards.balance.toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <Link
            href="/shop"
            onClick={() => setOpen(false)}
            className={buttonClass({ className: "mt-3 w-full gap-2" })}
          >
            {t("rewards.openShop")}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Header points: a sparkle and the balance, one tap to the shop. Hidden until rewards load. */
export function PointsPill() {
  const { t } = useI18n();
  const { data: rewards } = useRewards();
  if (!rewards) return null;
  const label = t("rewards.ptsValue").replace("{n}", rewards.balance.toLocaleString());
  return (
    <Link
      href="/shop"
      aria-label={label}
      title={label}
      className="flex h-10 items-center gap-1 rounded-xl border border-border bg-white px-2.5 text-[14px] font-bold tabular-nums text-foreground transition-colors hover:bg-muted sm:px-3"
    >
      <Sparkles className="size-[18px] text-accent" fill="currentColor" strokeWidth={1.6} />
      {rewards.balance.toLocaleString()}
    </Link>
  );
}
