import type { CalendarEventRow, ImportResult, ImportSource } from "./api/exam-import";
import { dayLabel, fill } from "./exam-planner-view";

type Translate = (key: string) => string;

/** "13:30", or "Morning" / "Afternoon" for a timetable's AM / PM session; "" for all-day. */
export function timeLabel(time: string | null | undefined, t: Translate): string {
  if (!time) return "";
  if (time === "am" || time === "pm") return t(`ei.time.${time}`);
  return time;
}

/** "Tue 4 May · 13:30" */
export function whenLabel(date: string | null, time: string | null | undefined, locale: string, t: Translate): string {
  if (!date) return timeLabel(time, t);
  const day = dayLabel(date, locale, { weekday: "short", day: "numeric", month: "short" });
  const at = timeLabel(time, t);
  return at ? `${day} · ${at}` : day;
}

/** The summary's headline for what an import did. A file and an .ics share the "file" wording. */
export function importHeadline(result: Pick<ImportResult, "source" | "added" | "suggested">, t: Translate): { title: string; body: string | null } {
  const from = result.source === "google" ? "google" : "file";
  const n = result.added.length;
  if (n > 0) return { title: n === 1 ? t(`ei.added.${from}One`) : fill(t(`ei.added.${from}`), { n }), body: t("ei.added.body") };
  if (result.suggested.length > 0) return { title: t(`ei.onlyMaybe.${from}`), body: null };
  return { title: t(`ei.none.${from}`), body: t(`ei.none.${from}Body`) };
}

/** The planner's one-line note after a calendar read; null when there is nothing to say. */
export function syncNote(result: Pick<ImportResult, "added" | "suggested" | "moved">, locale: string, t: Translate): { text: string; action: "review" | "check" | null } | null {
  const n = result.added.length;
  if (n > 0) return { text: n === 1 ? t("ei.added.googleOne") : fill(t("ei.added.google"), { n }), action: "review" };
  const m = result.suggested.length;
  if (m > 0) return { text: m === 1 ? t("ei.maybe.headingOne") : fill(t("ei.maybe.heading"), { n: m }), action: "check" };
  const moved = result.moved[0];
  if (moved) return { text: fill(t("ei.moved"), { title: moved.title, day: dayLabel(moved.to, locale, { weekday: "short", day: "numeric", month: "short" }) }), action: null };
  return null;
}

/** Events whose title holds every word typed (any order, any case). */
export function filterEvents<T extends Pick<CalendarEventRow, "title">>(events: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return events;
  return events.filter((e) => {
    const title = e.title.toLowerCase();
    return words.every((w) => title.includes(w));
  });
}

export const sourceLabelKey = (source: ImportSource) => `ei.exam.from.${source}`;
