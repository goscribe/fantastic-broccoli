"use client";

import { useMemo, useSyncExternalStore } from "react";
import type {
  ClozeContent,
  FlashcardContent,
  McqContent,
  SessionActivity,
  VocabRecallContent,
} from "@/types";

/**
 * "Schedule next" review reminders set from the session debrief.
 *
 * Reminders live in this browser (localStorage) and surface in-app as the
 * home "Your review is ready" strip once due; learners can also export them
 * to their own calendar. The deep link opens the due-card review filtered to
 * the reminder's workspace, so it lands on the first question.
 */

export type ReminderChannel = "in_app" | "google_calendar" | "ics";

export interface ReviewReminder {
  id: string;
  workspaceId: string;
  workspaceTitle: string;
  sessionId: string;
  /** ISO time the review is due. */
  scheduledAt: string;
  createdAt: string;
  /** SRS cards studied in the session (they come due ~1 day later). */
  dueCount: number;
  estMinutes: number;
  channels: ReminderChannel[];
  /** Set once the learner opens the review from the reminder. */
  openedAt?: string;
}

const STORAGE_KEY = "scribe_review_reminders_v1";
/** Reminders this old are dropped even if never opened. */
const EXPIRE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const SECONDS_PER_CARD = 20;

const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): ReviewReminder[] {
  try {
    const parsed = JSON.parse(raw) as ReviewReminder[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - EXPIRE_AFTER_MS;
    return parsed.filter(
      (r) =>
        typeof r?.id === "string" &&
        typeof r.workspaceId === "string" &&
        Date.parse(r.scheduledAt) > cutoff,
    );
  } catch {
    return [];
  }
}

function write(reminders: ReviewReminder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch {
    // Private mode: the reminder only lives for this page view.
  }
  listeners.forEach((l) => l());
}

export function listReminders(): ReviewReminder[] {
  return parse(readRaw());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live list of this browser's reminders. */
export function useReviewReminders(): ReviewReminder[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}

/** One reminder per workspace: scheduling again replaces the previous one. */
export function saveReminder(reminder: ReviewReminder): void {
  write([
    ...listReminders().filter((r) => r.workspaceId !== reminder.workspaceId),
    reminder,
  ]);
}

export function updateReminder(
  id: string,
  patch: Partial<Omit<ReviewReminder, "id">>,
): void {
  write(listReminders().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function addReminderChannel(id: string, channel: ReminderChannel): void {
  const reminder = listReminders().find((r) => r.id === id);
  if (!reminder || reminder.channels.includes(channel)) return;
  updateReminder(id, { channels: [...reminder.channels, channel] });
}

export function markReminderOpened(id: string): ReviewReminder | undefined {
  const reminder = listReminders().find((r) => r.id === id);
  if (!reminder) return undefined;
  if (!reminder.openedAt) {
    updateReminder(id, { openedAt: new Date().toISOString() });
  }
  return reminder;
}

/** Earliest reminder that is due now and hasn't been opened. */
export function dueReminder(
  reminders: ReviewReminder[],
  now = Date.now(),
): ReviewReminder | undefined {
  return reminders
    .filter((r) => !r.openedAt && Date.parse(r.scheduledAt) <= now)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
}

/** Next reminder still in the future. */
export function upcomingReminder(
  reminders: ReviewReminder[],
  now = Date.now(),
): ReviewReminder | undefined {
  return reminders
    .filter((r) => !r.openedAt && Date.parse(r.scheduledAt) > now)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
}

export function newReminderId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Same time tomorrow, rounded to the nearest quarter hour. */
export function defaultReminderTime(now = new Date()): Date {
  const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const quarter = 15 * 60 * 1000;
  return new Date(Math.round(d.getTime() / quarter) * quarter);
}

/** `<input type="datetime-local">` value in the browser's local time. */
export function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "tomorrow at 9:15 AM", "today at …", else a short weekday/date/time. */
export function formatReminderWhen(
  iso: string,
  locale: string,
  t: (key: "retention.today" | "retention.tomorrow") => string,
  now = new Date(),
): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString())
    return t("retention.today").replace("{time}", time);
  if (d.toDateString() === tomorrow.toDateString())
    return t("retention.tomorrow").replace("{time}", time);
  return d.toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Distinct SRS cards a session's finished activities recorded attempts on. */
export function reviewSetFromActivities(activities: SessionActivity[]): {
  dueCount: number;
  estMinutes: number;
} {
  const ids = new Set<string>();
  for (const a of activities) {
    if (a.status !== "completed") continue;
    const content = a.content as unknown;
    if (a.type === "flashcard_review") {
      (content as FlashcardContent).cards?.forEach((c) => c.flashcardId && ids.add(c.flashcardId));
    } else if (a.type === "vocab_recall") {
      (content as VocabRecallContent).terms?.forEach((t) => t.flashcardId && ids.add(t.flashcardId));
    } else if (a.type === "mcq") {
      (content as McqContent).questions?.forEach(
        (q) => q.sourceFlashcardId && ids.add(q.sourceFlashcardId),
      );
    } else if (a.type === "cloze") {
      (content as ClozeContent).passages?.forEach((p) =>
        p.flashcardIds?.forEach((id) => ids.add(id)),
      );
    }
  }
  return { dueCount: ids.size, estMinutes: estimateReviewMinutes(ids.size) };
}

export function estimateReviewMinutes(cardCount: number): number {
  return Math.max(2, Math.ceil((cardCount * SECONDS_PER_CARD) / 60));
}

/** Where a reminder opens: the due-card review for that workspace. */
export function reviewDeepLink(
  reminder: Pick<ReviewReminder, "id" | "workspaceId">,
  src: string,
): string {
  const params = new URLSearchParams({
    workspace: reminder.workspaceId,
    reminder: reminder.id,
    src,
  });
  return `/flashcards/review?${params.toString()}`;
}

function eventWindow(reminder: ReviewReminder): { start: Date; end: Date } {
  const start = new Date(reminder.scheduledAt);
  const end = new Date(start.getTime() + Math.max(10, reminder.estMinutes) * 60 * 1000);
  return { start, end };
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventText(reminder: ReviewReminder, url: string) {
  const summary = `Scribe review: ${reminder.workspaceTitle}`;
  const body =
    reminder.dueCount > 0
      ? `${reminder.dueCount} cards due · about ${reminder.estMinutes} min.`
      : `A short review · about ${reminder.estMinutes} min.`;
  return { summary, description: `${body}\nStart: ${url}` };
}

export function googleCalendarUrl(reminder: ReviewReminder, origin: string): string {
  const url = origin + reviewDeepLink(reminder, "calendar");
  const { start, end } = eventWindow(reminder);
  const { summary, description } = eventText(reminder, url);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: description,
    location: url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function icsFile(reminder: ReviewReminder, origin: string): string {
  const url = origin + reviewDeepLink(reminder, "calendar");
  const { start, end } = eventWindow(reminder);
  const { summary, description } = eventText(reminder, url);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scribe//Review reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reminder.id}@scribe.study`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your Scribe review is ready",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(reminder: ReviewReminder, origin: string): void {
  const blob = new Blob([icsFile(reminder, origin)], { type: "text/calendar" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "scribe-review.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
