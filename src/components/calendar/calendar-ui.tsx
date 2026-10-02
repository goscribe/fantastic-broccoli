"use client";

import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEventKind } from "@/lib/calendar/ics";
import { dayDiff } from "@/lib/calendar/planner";
import type { TranslationKey } from "@/lib/i18n";

type T = (key: TranslationKey) => string;

export const KIND_STYLES: Record<CalendarEventKind, string> = {
  exam: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300",
  deadline:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  class: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300",
  other: "border-border bg-muted text-muted-foreground",
};

export const KIND_ICONS: Record<CalendarEventKind, React.ComponentType<{ className?: string }>> = {
  exam: GraduationCap,
  deadline: ClipboardCheck,
  class: BookOpen,
  other: CalendarDays,
};

export function KindBadge({
  kind,
  t,
  className,
}: {
  kind: CalendarEventKind;
  t: T;
  className?: string;
}) {
  const Icon = KIND_ICONS[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        KIND_STYLES[kind],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {t(`cal.kind.${kind}`)}
    </span>
  );
}

export const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function formatDayLabel(day: Date, locale: string, t: T, now: Date): string {
  const diff = dayDiff(day, now);
  const date = day.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  if (diff === 0) return `${t("cal.today")} · ${date}`;
  if (diff === 1) return `${t("cal.tomorrow")} · ${date}`;
  return date;
}

export function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatSessionWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "today" / "tomorrow" / "in 6 days". */
export function relativeDays(iso: string, t: T, now: Date): string {
  const diff = dayDiff(new Date(iso), now);
  if (diff <= 0) return t("cal.target.today");
  if (diff === 1) return t("cal.target.tomorrow");
  return fill(t("cal.target.inDays"), { days: diff });
}

export function daysBeforeLabel(days: number, t: T): string {
  if (days <= 0) return t("cal.session.sameDay");
  if (days === 1) return t("cal.session.dayBefore");
  return fill(t("cal.session.daysBefore"), { days });
}
