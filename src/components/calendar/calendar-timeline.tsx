"use client";

import { useMemo, useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";
import {
  CALENDAR_EVENT_KINDS,
  startOfLocalDay,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/calendar/ics";
import type { PlannedSession } from "@/lib/calendar/planner";
import { KIND_STYLES, fill, formatDayLabel, formatTime } from "./calendar-ui";

export interface TimelineSession {
  session: PlannedSession;
  state: "suggested" | "planned";
}

type Item =
  | { type: "event"; at: string; event: CalendarEvent; kind: CalendarEventKind }
  | { type: "session"; at: string; entry: TimelineSession };

const PAGE_DAYS = 10;

export function CalendarTimeline({
  events,
  kindOf,
  sessions,
  onChangeKind,
  now,
}: {
  events: CalendarEvent[];
  kindOf: (event: CalendarEvent) => CalendarEventKind;
  sessions: TimelineSession[];
  onChangeKind: (event: CalendarEvent, kind: CalendarEventKind) => void;
  now: Date;
}) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<"all" | "important">("all");
  const [visibleDays, setVisibleDays] = useState(PAGE_DAYS);

  const days = useMemo(() => {
    const nowMs = now.getTime();
    const items: Item[] = [];
    for (const event of events) {
      const kind = kindOf(event);
      if (filter === "important" && kind !== "exam" && kind !== "deadline") continue;
      const ended = event.allDay
        ? Date.parse(event.end) <= startOfLocalDay(now).getTime()
        : Math.max(Date.parse(event.end), Date.parse(event.start)) < nowMs;
      if (ended) continue;
      items.push({ type: "event", at: event.start, event, kind });
    }
    for (const entry of sessions) {
      items.push({ type: "session", at: entry.session.start, entry });
    }
    items.sort((a, b) => {
      const allDayA = a.type === "event" && a.event.allDay;
      const allDayB = b.type === "event" && b.event.allDay;
      const dayA = startOfLocalDay(new Date(a.at)).getTime();
      const dayB = startOfLocalDay(new Date(b.at)).getTime();
      if (dayA !== dayB) return dayA - dayB;
      if (allDayA !== allDayB) return allDayA ? -1 : 1;
      return a.at.localeCompare(b.at);
    });
    const groups = new Map<number, Item[]>();
    for (const item of items) {
      const key = startOfLocalDay(new Date(item.at)).getTime();
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()];
  }, [events, kindOf, sessions, filter, now]);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">{t("cal.timeline.title")}</h2>
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          {(["all", "important"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(f === "all" ? "cal.filter.all" : "cal.filter.important")}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t("cal.timeline.empty")}
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {days.slice(0, visibleDays).map(([dayMs, items]) => (
            <li key={dayMs} className="px-4 py-3 sm:px-5">
              <p className="text-[11px] font-semibold text-faint">
                {formatDayLabel(new Date(dayMs), locale, t, now)}
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((item) =>
                  item.type === "event" ? (
                    <li key={item.event.id} className="flex items-start gap-3">
                      <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                        {item.event.allDay ? t("cal.allDay") : formatTime(item.event.start, locale)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[13px]",
                            item.kind === "exam" || item.kind === "deadline"
                              ? "font-semibold"
                              : "font-medium",
                          )}
                        >
                          {item.event.title}
                        </p>
                        {item.event.location && (
                          <p className="flex items-center gap-1 truncate text-[11px] text-faint">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {item.event.location}
                          </p>
                        )}
                      </div>
                      <select
                        aria-label={t("cal.changeType")}
                        title={t("cal.changeType")}
                        value={item.kind}
                        onChange={(e) =>
                          onChangeKind(item.event, e.target.value as CalendarEventKind)
                        }
                        className={cn(
                          "shrink-0 cursor-pointer appearance-none rounded-full border px-2.5 py-0.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring",
                          KIND_STYLES[item.kind],
                        )}
                      >
                        {CALENDAR_EVENT_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t(`cal.kind.${k}`)}
                          </option>
                        ))}
                      </select>
                    </li>
                  ) : (
                    <li
                      key={item.entry.session.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-2.5 py-1.5 -mx-2.5",
                        item.entry.state === "planned"
                          ? "border-accent/40 bg-accent-soft"
                          : "border-dashed border-accent/50 bg-accent-soft/40",
                      )}
                    >
                      <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-accent">
                        {formatTime(item.entry.session.start, locale)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-accent">
                          {t(`cal.focus.${item.entry.session.focus}`)} ·{" "}
                          <span className="font-medium text-foreground">
                            {item.entry.session.targetTitle}
                          </span>
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent">
                        <Sparkles className="h-3 w-3" />
                        <span className="hidden sm:inline">
                          {item.entry.state === "planned"
                            ? t("cal.session.planned")
                            : t("cal.session.suggested")}
                          {" · "}
                        </span>
                        {fill(t("cal.session.minutes"), { minutes: item.entry.session.minutes })}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {days.length > visibleDays && (
        <div className="border-t border-border px-5 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleDays((n) => n + PAGE_DAYS)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {t("cal.timeline.showMore")}
          </button>
        </div>
      )}
    </section>
  );
}
