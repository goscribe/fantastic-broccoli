import { rpc } from "./study-session";
import type { ReminderPrefs } from "@/lib/reminders";

/** Typed calls to the server's `reminders` router (newer than the published types). */
export const remindersApi = {
  get: () => rpc<ReminderPrefs>("reminders.get", "query", undefined),
  setStudyTime: (minute: number | null) => rpc<ReminderPrefs>("reminders.setStudyTime", "mutation", { minute }),
  markAsked: (prompt: "study_time" | "push") => rpc<{ ok: true }>("reminders.markAsked", "mutation", { prompt }),
  subscribePush: (sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) =>
    rpc<{ ok: true; devices: number }>("reminders.subscribePush", "mutation", sub),
  unsubscribePush: (endpoint: string) => rpc<{ ok: true }>("reminders.unsubscribePush", "mutation", { endpoint }),
};

export const REMINDER_PREFS_KEY = ["reminder-prefs"] as const;
