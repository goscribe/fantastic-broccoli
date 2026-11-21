/**
 * The week strip in home's banner: the planner's week (`planner.getWeek`)
 * as seven days, Monday first, each with its planned study times. Today's
 * day carries home's one action (from `home.summary`), so the strip never
 * waits for anything but its own request.
 *
 * Pure (no framework imports) so it is unit-tested.
 */

export interface WeekSlotInput {
  id: string;
  kind: "session" | "review";
  title: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  sessionId?: string;
  workspaceId?: string;
}

export interface WeekDayInput {
  date: string;
  slots: WeekSlotInput[];
}

export interface WeekItem {
  id: string;
  title: string;
  /** "17:00" */
  time: string;
  minutes: number;
  kind: "session" | "review";
  /** The subject it belongs to (its colour on the strip); none for review blocks. */
  workspaceId?: string;
  /** A session opens itself, a review block opens the flashcard review, anything else the planner. */
  href: string;
}

export interface WeekCell {
  date: string;
  /** 0 = Monday … 6 = Sunday. */
  dow: number;
  /** Day of the month, 1–31. */
  day: number;
  isToday: boolean;
  past: boolean;
  /** Planned study minutes that day. */
  minutes: number;
  items: WeekItem[];
}

/** YYYY-MM-DD in the device's own time zone (not UTC: the planner's days are the student's). */
export function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 0 = Monday … 6 = Sunday, for a YYYY-MM-DD. */
export function weekdayOf(ymd: string): number {
  return (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday to Sunday of the week holding `today`, for the strip shown before the planner answers. */
export function weekDates(today: string): string[] {
  const monday = addDays(today, -weekdayOf(today));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function slotHref(s: Pick<WeekSlotInput, "kind" | "sessionId" | "workspaceId">): string {
  if (s.sessionId && s.workspaceId) return `/workspace/${s.workspaceId}/session/${s.sessionId}`;
  if (s.kind === "review") return "/flashcards/review";
  return "/planner";
}

/** The seven days of the strip. Without `days` (still loading, or failed) the cells are empty. */
export function weekCells(today: string, days?: WeekDayInput[] | null): WeekCell[] {
  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const dates = days && days.length === 7 ? days.map((d) => d.date) : weekDates(today);
  return dates.map((date) => {
    const slots = [...(byDate.get(date)?.slots ?? [])].sort((a, b) => a.start - b.start);
    return {
      date,
      dow: weekdayOf(date),
      day: Number(date.slice(8, 10)),
      isToday: date === today,
      past: date < today,
      minutes: slots.reduce((n, s) => n + Math.max(0, s.end - s.start), 0),
      items: slots.map((s) => ({
        id: s.id,
        title: s.title,
        time: hhmm(s.start),
        minutes: Math.max(0, s.end - s.start),
        kind: s.kind,
        workspaceId: s.workspaceId,
        href: slotHref(s),
      })),
    };
  });
}

/**
 * How a day reads on the strip. `done`: the streak counted it (any finished
 * activity, or a freeze); `missed`: it is over, something was planned and
 * nothing counted; `free`: nothing planned (and not done); `planned`: today
 * or later with study times still ahead. `doneDates` are the streak's days
 * that counted (`streak.get` → week[].done or .frozen).
 */
export type DayState = "done" | "missed" | "free" | "planned";

export function dayState(cell: Pick<WeekCell, "date" | "past" | "items">, doneDates: ReadonlySet<string>): DayState {
  if (doneDates.has(cell.date)) return "done";
  if (cell.items.length === 0) return "free";
  return cell.past ? "missed" : "planned";
}

/** The streak's days that counted, as a set of YYYY-MM-DD. */
export function streakDoneDates(week: { date: string; done: boolean; frozen?: boolean }[] | null | undefined): Set<string> {
  return new Set((week ?? []).filter((d) => d.done || d.frozen).map((d) => d.date));
}

/** Nothing planned anywhere this week: the banner asks the student to set the week up instead of drawing an empty grid. */
export function isEmptyWeek(days: WeekDayInput[] | null | undefined): boolean {
  return !!days && days.every((d) => d.slots.length === 0);
}

/** "40 min", "1 h", "2.5 h": a week's or a day's planned time. */
export function plannedLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.round((m / 60) * 10) / 10;
  return `${h} h`;
}
