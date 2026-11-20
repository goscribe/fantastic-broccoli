/** Pure helpers for the exam planner UI (formatting, task titles, coverage). */

export type Translate = (key: string) => string;

/** Replaces `{name}` placeholders. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function fmtDuration(min: number, t: Translate): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return fill(t("ep.dur.m"), { m });
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? fill(t("ep.dur.hm"), { h, m: r }) : fill(t("ep.dur.h"), { h });
}

/** What a task is called: the topic, or the exam for whole-paper tasks. */
export function taskTitle(task: { kind: string; label: string; topic: string | null }, t: Translate): string {
  if (task.kind === "mock") return fill(t("ep.task.mock"), { exam: task.label });
  if (task.kind === "quick5" && !task.topic) return fill(t("ep.task.recap"), { exam: task.label });
  return task.label;
}

export const weeklyMinutes = (weekdayMinutes: number[]) => weekdayMinutes.reduce((a, b) => a + Math.max(0, b), 0);

/** Percent widths for the coverage bar: secure (strong) inside covered (soft). */
export function coverageBar(e: { topics: number; covered: number; secure: number }): { covered: number; secure: number } {
  if (e.topics <= 0) return { covered: 0, secure: 0 };
  const covered = Math.min(100, Math.round((e.covered / e.topics) * 100));
  const secure = Math.min(covered, Math.round((e.secure / e.topics) * 100));
  return { covered, secure };
}

/** Sunday-first weekday minutes shown Monday-first, with the weekday index of each row. */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Local weekday / date label for a YYYY-MM-DD, in the UI locale. */
export function dayLabel(ymd: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale === "tl" ? "fil" : locale, { ...opts, timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
  } catch {
    return ymd;
  }
}

/** Short weekday names (Mon…Sun order) for the UI locale. */
export function weekdayNames(locale: string, width: "short" | "narrow" = "short"): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => dayLabel(`2024-01-0${i + 1}`, locale, { weekday: width }));
}

/** 6×7 month grid (Monday first) of YYYY-MM-DD, covering the month of `ymd`. */
export function monthGrid(ymd: string): string[] {
  const first = `${ymd.slice(0, 8)}01`;
  const d = new Date(`${first}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}
