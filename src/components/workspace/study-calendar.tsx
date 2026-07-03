"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DailyActivity = { date: string; count: number };

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function intensityClass(count: number): string {
  if (count === 0) return "bg-muted";
  if (count <= 1) return "bg-accent/30";
  if (count <= 3) return "bg-accent/60";
  return "bg-accent";
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function StudyCalendar({
  dailyActivity,
  className,
}: {
  dailyActivity: DailyActivity[];
  className?: string;
}) {
  const activityMap = useMemo(
    () => new Map(dailyActivity.map((entry) => [entry.date, entry.count])),
    [dailyActivity],
  );
  const earliest = dailyActivity[0]?.date;

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const earliestDate = earliest ? new Date(`${earliest}T12:00:00`) : null;
  const canGoPrev = earliestDate
    ? new Date(year, month - 1 + 1, 0) >= earliestDate
    : false;
  const canGoNext =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth());

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const todayStr = toIsoDate(new Date());

    const grid: Array<
      | { type: "empty"; key: string }
      | {
          type: "day";
          key: string;
          day: number;
          count: number;
          isToday: boolean;
        }
    > = [];
    for (let i = 0; i < firstWeekday; i++)
      grid.push({ type: "empty", key: `e-${i}` });
    for (let day = 1; day <= daysInMonth; day++) {
      const date = toIsoDate(new Date(year, month, day));
      grid.push({
        type: "day",
        key: date,
        day,
        count: activityMap.get(date) ?? 0,
        isToday: date === todayStr,
      });
    }
    return grid;
  }, [activityMap, month, year]);

  const activeDays = cells.filter(
    (c) => c.type === "day" && c.count > 0,
  ).length;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{monthLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {activeDays} active day{activeDays !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="pb-0.5 text-center text-[10px] font-medium text-faint"
          >
            {label}
          </div>
        ))}
        {cells.map((cell) =>
          cell.type === "empty" ? (
            <div key={cell.key} className="aspect-square" aria-hidden />
          ) : (
            <div
              key={cell.key}
              title={`${cell.count} session${cell.count !== 1 ? "s" : ""}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[10px] font-medium tabular-nums",
                intensityClass(cell.count),
                cell.count > 3 || cell.count === 0
                  ? cell.count === 0
                    ? "text-faint"
                    : "text-white"
                  : "text-foreground",
                cell.isToday && "ring-1 ring-accent",
              )}
            >
              {cell.day}
            </div>
          ),
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-faint">
        <span>Less</span>
        <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
        <div className="h-2.5 w-2.5 rounded-sm bg-accent/30" />
        <div className="h-2.5 w-2.5 rounded-sm bg-accent/60" />
        <div className="h-2.5 w-2.5 rounded-sm bg-accent" />
        <span>More</span>
      </div>
    </div>
  );
}
