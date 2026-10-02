import {
  hashId,
  startOfLocalDay,
  subjectOf,
  type CalendarEvent,
  type CalendarEventKind,
} from "./ics";

/**
 * Proposes study sessions before each exam and deadline, spaced out (more,
 * earlier sessions for exams) and only in free gaps of the learner's study
 * window — never on top of a class or another planned session.
 */

export type StudyWindow = "after_school" | "daytime" | "evening";
export type TargetKind = Extract<CalendarEventKind, "exam" | "deadline">;
export type SessionFocus = "learn" | "practice" | "recap" | "plan" | "work" | "finish";

export interface PlanPrefs {
  sessionMinutes: 30 | 45 | 60;
  window: StudyWindow;
  maxPerDay: 1 | 2 | 3;
  weekends: boolean;
}

export const DEFAULT_PLAN_PREFS: PlanPrefs = {
  sessionMinutes: 45,
  window: "after_school",
  maxPerDay: 2,
  weekends: true,
};

export interface PlannedSession {
  id: string;
  targetId: string;
  targetTitle: string;
  targetKind: TargetKind;
  /** ISO start of the exam/deadline. */
  targetStart: string;
  subject: string;
  focus: SessionFocus;
  start: string;
  end: string;
  minutes: number;
  /** Calendar days between this session and the exam/deadline. */
  daysBefore: number;
}

export interface PlanTarget {
  event: CalendarEvent;
  kind: TargetKind;
  /** Sessions the spacing schedule asked for, given the days left. */
  wanted: number;
  sessions: PlannedSession[];
  /** No study day left before it. */
  tooSoon: boolean;
  /** The learner chose not to plan for it. */
  excluded: boolean;
}

export interface StudyPlan {
  targets: PlanTarget[];
  sessions: PlannedSession[];
}

const MINUTE = 60_000;
const DAY_MS = 24 * 60 * MINUTE;
const BUFFER_MS = 15 * MINUTE;
const QUARTER_MS = 15 * MINUTE;

/** Days before the target, earliest first. */
const SPACING: Record<TargetKind, number[]> = {
  exam: [7, 4, 2, 1],
  deadline: [5, 3, 1],
};

const FOCUS: Record<TargetKind, [SessionFocus, SessionFocus, SessionFocus]> = {
  exam: ["learn", "practice", "recap"],
  deadline: ["plan", "work", "finish"],
};

/** Study window in minutes after local midnight. */
export function studyWindowFor(day: Date, window: StudyWindow): [number, number] {
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  switch (window) {
    case "after_school":
      return weekend ? [10 * 60, 20 * 60] : [16 * 60, 21 * 60];
    case "daytime":
      return [9 * 60, 17 * 60];
    case "evening":
      return [19 * 60, 23 * 60];
  }
}

const atMinutes = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes).getTime();

const ceilQuarter = (ms: number) => Math.ceil(ms / QUARTER_MS) * QUARTER_MS;

const addDays = (day: Date, n: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);

export const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfLocalDay(a).getTime() - startOfLocalDay(b).getTime()) / DAY_MS);

interface Interval {
  start: number;
  end: number;
}

function findSlot(
  day: Date,
  minutes: number,
  window: StudyWindow,
  busy: Interval[],
  earliestMs: number,
  latestEndMs: number,
): number | null {
  const [ws, we] = studyWindowFor(day, window);
  const to = Math.min(atMinutes(day, we), latestEndMs);
  let cursor = ceilQuarter(Math.max(atMinutes(day, ws), earliestMs));
  const need = minutes * MINUTE;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start >= to) break;
    if (b.start - cursor >= need) return cursor;
    cursor = Math.max(cursor, ceilQuarter(b.end));
  }
  return to - cursor >= need ? cursor : null;
}

function insertSorted(list: Interval[], item: Interval): void {
  const i = list.findIndex((x) => x.start > item.start);
  if (i < 0) list.push(item);
  else list.splice(i, 0, item);
}

export function buildStudyPlan({
  events,
  kindOf,
  excluded,
  prefs,
  now = new Date(),
}: {
  events: CalendarEvent[];
  kindOf: (event: CalendarEvent) => CalendarEventKind;
  excluded: Set<string>;
  prefs: PlanPrefs;
  now?: Date;
}): StudyPlan {
  const nowMs = now.getTime();
  const today = startOfLocalDay(now);
  const earliestMs = nowMs + 30 * MINUTE;

  const busy: Interval[] = events
    .filter((e) => e.busy)
    .map((e) => ({
      start: Date.parse(e.start) - BUFFER_MS,
      end: Math.max(Date.parse(e.end), Date.parse(e.start) + 30 * MINUTE) + BUFFER_MS,
    }))
    .sort((a, b) => a.start - b.start);

  const perDay = new Map<number, number>();
  const targets: PlanTarget[] = [];
  const sessions: PlannedSession[] = [];

  const targetEvents = events.filter((e) => {
    const k = kindOf(e);
    return (k === "exam" || k === "deadline") && Date.parse(e.start) > nowMs;
  });

  for (const event of targetEvents) {
    const kind = kindOf(event) as TargetKind;
    if (excluded.has(event.id)) {
      targets.push({ event, kind, wanted: 0, sessions: [], tooSoon: false, excluded: true });
      continue;
    }
    const targetStart = new Date(event.start);
    const targetDay = startOfLocalDay(targetStart);
    // Evening deadlines leave room for a same-day "finish & check".
    const sameDayOk = !event.allDay && kind === "deadline" && targetStart.getHours() >= 18;
    const lastDay = sameDayOk ? targetDay : addDays(targetDay, -1);
    const latestEndMs = event.allDay ? targetDay.getTime() : targetStart.getTime() - 60 * MINUTE;

    const allowed = (d: Date) =>
      d >= today && d <= lastDay && (prefs.weekends || (d.getDay() !== 0 && d.getDay() !== 6));
    let daysLeft = 0;
    for (let d = today; d <= lastDay; d = addDays(d, 1)) if (allowed(d)) daysLeft++;

    const spacing = SPACING[kind];
    const n = Math.min(spacing.length, daysLeft);
    const offsets = spacing.slice(spacing.length - n);
    const target: PlanTarget = {
      event,
      kind,
      wanted: n,
      sessions: [],
      tooSoon: daysLeft === 0,
      excluded: false,
    };
    const usedDays = new Set<number>();
    const subject = subjectOf(event.title);

    offsets.forEach((offset, index) => {
      const focus =
        index === offsets.length - 1 && offsets.length > 1
          ? FOCUS[kind][2]
          : index === 0
            ? FOCUS[kind][0]
            : FOCUS[kind][1];
      const minutes = focus === "recap" ? Math.min(30, prefs.sessionMinutes) : prefs.sessionMinutes;
      const preferred = addDays(targetDay, -offset);
      for (let step = 0; step < 14; step++) {
        const shift = step === 0 ? 0 : step % 2 === 1 ? -Math.ceil(step / 2) : step / 2;
        const day = addDays(preferred, shift);
        const key = day.getTime();
        if (!allowed(day) || usedDays.has(key) || (perDay.get(key) ?? 0) >= prefs.maxPerDay) continue;
        const slot = findSlot(day, minutes, prefs.window, busy, earliestMs, latestEndMs);
        if (slot === null) continue;
        const end = slot + minutes * MINUTE;
        usedDays.add(key);
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
        insertSorted(busy, { start: slot - BUFFER_MS, end: end + BUFFER_MS });
        const session: PlannedSession = {
          id: `ps_${hashId(`${event.id}|${index}`)}`,
          targetId: event.id,
          targetTitle: event.title,
          targetKind: kind,
          targetStart: event.start,
          subject,
          focus,
          start: new Date(slot).toISOString(),
          end: new Date(end).toISOString(),
          minutes,
          daysBefore: dayDiff(targetDay, day),
        };
        target.sessions.push(session);
        sessions.push(session);
        return;
      }
    });

    target.sessions.sort((a, b) => a.start.localeCompare(b.start));
    targets.push(target);
  }

  sessions.sort((a, b) => a.start.localeCompare(b.start));
  return { targets, sessions };
}

/** The suggested sessions after the learner's removals and time changes. */
export function applyPlanEdits(
  sessions: PlannedSession[],
  edits: { removed: string[]; starts: Record<string, string> },
): PlannedSession[] {
  const removed = new Set(edits.removed);
  return sessions
    .filter((s) => !removed.has(s.id))
    .map((s) => {
      const start = edits.starts[s.id];
      if (!start) return s;
      return {
        ...s,
        start,
        end: new Date(Date.parse(start) + s.minutes * MINUTE).toISOString(),
        daysBefore: dayDiff(new Date(s.targetStart), new Date(start)),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** First busy calendar event a session overlaps, if any. */
export function conflictFor(
  session: Pick<PlannedSession, "start" | "end">,
  events: CalendarEvent[],
): CalendarEvent | undefined {
  const s = Date.parse(session.start);
  const e = Date.parse(session.end);
  return events.find((ev) => ev.busy && Date.parse(ev.start) < e && Date.parse(ev.end) > s);
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 2),
  );

/** Workspace whose title shares the most words with the event's subject. */
export function matchWorkspace<W extends { id: string; title: string }>(
  subject: string,
  workspaces: W[],
): W | undefined {
  const want = tokens(subject);
  let best: W | undefined;
  let bestScore = 0;
  for (const w of workspaces) {
    let score = 0;
    for (const t of tokens(w.title)) if (want.has(t)) score++;
    if (score > bestScore) {
      best = w;
      bestScore = score;
    }
  }
  return best;
}
