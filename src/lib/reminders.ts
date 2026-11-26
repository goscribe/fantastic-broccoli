/**
 * Study-time reminders and the asks on a finished session's end screen
 * ("When do you want to study tomorrow?", then "Get the reminder as a
 * notification", or an install hint). Pure: no React or API imports, so the
 * decisions can be unit tested.
 */

/** Minutes after local midnight. Mirrors the server's STUDY_TIME_PRESETS. */
export const STUDY_TIME_PRESETS = {
  morning: 7 * 60,
  afterSchool: 16 * 60,
  evening: 19 * 60,
  late: 21 * 60,
} as const;
export type StudyTimePreset = keyof typeof STUDY_TIME_PRESETS;
export const STUDY_TIME_PRESET_ORDER: StudyTimePreset[] = ["morning", "afterSchool", "evening", "late"];

/** What the server sends at when no time was chosen (the comeback loop's default). */
export const DEFAULT_REMINDER_MINUTE = 17 * 60;
/** Custom times snap to the comeback job's 15-minute runs. */
export const STUDY_TIME_STEP = 15;

export function presetFor(minute: number | null | undefined): StudyTimePreset | null {
  if (minute == null) return null;
  return STUDY_TIME_PRESET_ORDER.find((p) => STUDY_TIME_PRESETS[p] === minute) ?? null;
}

/** "19:00" for an <input type="time">. */
export function minuteToTimeInput(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parses "HH:MM" and snaps to the nearest 15 minutes (same day); null when invalid. */
export function timeInputToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  const snapped = Math.round((h * 60 + m) / STUDY_TIME_STEP) * STUDY_TIME_STEP;
  return Math.min(snapped, 24 * 60 - STUDY_TIME_STEP);
}

/** "7 PM" / "19:00" / "下午7点" in the UI locale; minutes only when not on the hour. */
export function formatStudyTime(minute: number, locale: string): string {
  const d = new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60);
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      ...(minute % 60 ? { minute: "2-digit" } : {}),
    }).format(d);
  } catch {
    return minuteToTimeInput(minute);
  }
}

export interface Platform {
  /** iPhone/iPad Safari (or another iOS browser: all WebKit). */
  ios: boolean;
  /** Running from the home screen (display-mode: standalone / navigator.standalone). */
  standalone: boolean;
  /** Service worker + PushManager + Notification exist here. */
  pushSupported: boolean;
  /** Notification.permission, when the API exists. */
  permission: "default" | "granted" | "denied" | "unsupported";
  /** Chrome/Edge fired beforeinstallprompt and we still hold it. */
  canInstall: boolean;
}

/** Reads the platform; safe on the server (everything false). */
export function detectPlatform(canInstall = false): Platform {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ios: false, standalone: false, pushSupported: false, permission: "unsupported", canInstall: false };
  }
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const standalone =
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  return { ios, standalone, pushSupported, permission, canInstall };
}

export interface ReminderPrefs {
  studyReminderMinute: number | null;
  studyTimeAsked: boolean;
  pushAsked: boolean;
  pushAvailable: boolean;
  vapidPublicKey: string | null;
  pushDevices: number;
  timezone: string | null;
  /** When each ask was last shown (ISO) and how many times. Absent on an older server, which only knows "asked". */
  studyTimeAskedAt?: string | null;
  pushAskedAt?: string | null;
  studyTimeAsks?: number;
  pushAsks?: number;
}

/** Per-device "already shown" markers (the install hints are about this device). */
export interface DeviceSeen {
  iosInstallHint: boolean;
  androidInstall: boolean;
}

/** What localStorage keeps: the markers plus the user agent they were set under. */
export interface StoredDeviceSeen extends Partial<DeviceSeen> {
  ua?: string;
}

/**
 * The markers that still count for this browser. A different user agent (a
 * browser or OS update, "Request desktop site", a new phone restored from a
 * backup) clears them, so the install hint can come back; markers saved
 * before the user agent was recorded count as changed too.
 */
export function deviceSeenFor(stored: StoredDeviceSeen | null | undefined, userAgent: string): DeviceSeen {
  if (!stored || stored.ua !== userAgent) return { iosInstallHint: false, androidInstall: false };
  return { iosInstallHint: !!stored.iosInstallHint, androidInstall: !!stored.androidInstall };
}

export type HabitStep = "study_time" | "push" | "ios_install" | "android_install";

/** A dismissed ask comes back after this long. */
export const REASK_GAP_DAYS = 7;
/** Each ask is shown this many times at most; after that the answer is "no" (Settings still has both). */
export const MAX_ASKS = 3;
/** After any ask, a different one waits at least this long (a "no" to one isn't followed by the other the next day). */
export const QUIET_DAYS_BETWEEN_ASKS = 3;
const DAY_MS = 86_400_000;

function msSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? now - at : null;
}

/** Never shown, or shown and left unanswered long enough ago and not too often. */
function askDue(asked: boolean, askedAt: string | null | undefined, asks: number | undefined, now: number): boolean {
  if (!asked) return true;
  const since = msSince(askedAt, now);
  // An older server only says "asked": keep its ask-once behaviour.
  if (since === null) return false;
  if ((asks ?? 1) >= MAX_ASKS) return false;
  return since >= REASK_GAP_DAYS * DAY_MS;
}

/** "When do you want to study tomorrow?" is due: no time set, and never asked or dismissed a while ago. */
export function studyTimeAskDue(prefs: ReminderPrefs, now: number): boolean {
  if (prefs.studyReminderMinute != null) return false;
  return askDue(prefs.studyTimeAsked, prefs.studyTimeAskedAt, prefs.studyTimeAsks, now);
}

/** Whether this browser can ask for push permission right now. */
export function canAskPush(prefs: ReminderPrefs, platform: Platform): boolean {
  return (
    prefs.pushAvailable &&
    isUsableVapidKey(prefs.vapidPublicKey) &&
    platform.pushSupported &&
    platform.permission === "default" &&
    // iOS only delivers web push to the home-screen app.
    (!platform.ios || platform.standalone)
  );
}

/**
 * "Get the reminder as a notification" is due: push would work here (server
 * keys, a browser that supports it and hasn't decided, not iOS Safari outside
 * the home-screen app), and it was never asked or was dismissed a while ago.
 */
export function pushAskDue(prefs: ReminderPrefs, platform: Platform, now: number): boolean {
  return canAskPush(prefs, platform) && askDue(prefs.pushAsked, prefs.pushAskedAt, prefs.pushAsks, now);
}

/**
 * The asks to show on a finished session's end screen, in order, at most two:
 * the study-time question first (it works with email alone), then one of the
 * push offer, the iOS "Add to Home Screen" hint (once per device, only after
 * a good session) or the Android install offer (once per device).
 *
 * Nothing when an ask was already shown in this visit. Without the study-time
 * question in front, the second ask also waits out a quiet period after the
 * last ask of either kind. The sheet stops after a "not now" on the first
 * step, so the second is only ever offered to someone who just said yes.
 */
export function habitSteps(input: {
  prefs: ReminderPrefs;
  platform: Platform;
  seen: DeviceSeen;
  /** Finished with a decent score; the iOS hint waits for one. */
  goodSession: boolean;
  /** Date.now(); the re-ask gaps are measured from it. */
  now: number;
  /** An ask was already shown since the app was opened (once per visit). */
  askedThisVisit?: boolean;
}): HabitStep[] {
  const { prefs, platform, seen, goodSession, now } = input;
  if (input.askedThisVisit) return [];
  const steps: HabitStep[] = [];
  if (studyTimeAskDue(prefs, now)) steps.push("study_time");
  if (steps.length === 0) {
    const last = [msSince(prefs.studyTimeAskedAt, now), msSince(prefs.pushAskedAt, now)].filter((v): v is number => v !== null);
    if (last.some((since) => since < QUIET_DAYS_BETWEEN_ASKS * DAY_MS)) return [];
  }
  if (pushAskDue(prefs, platform, now)) {
    steps.push("push");
  } else if (platform.ios && !platform.standalone && !seen.iosInstallHint && goodSession) {
    steps.push("ios_install");
  } else if (!platform.ios && !platform.standalone && platform.canInstall && !seen.androidInstall) {
    steps.push("android_install");
  }
  return steps.slice(0, 2);
}

/** The step after `index`, or null when the sheet is done: a "not now" on the study time ends it. */
export function nextHabitStep(steps: HabitStep[], index: number, outcome: "answered" | "dismissed"): number | null {
  if (outcome === "dismissed" && steps[index] === "study_time") return null;
  return index + 1 < steps.length ? index + 1 : null;
}

/** A VAPID public key is 65 bytes of URL-safe base64; anything else would make the browser's subscribe throw. */
export function isUsableVapidKey(key: string | null | undefined): key is string {
  return !!key && /^[A-Za-z0-9_-]{87}$/.test(key);
}

/** A session worth celebrating: most answers right, or nothing to score. */
export function isGoodSession(accuracy: number | null | undefined, activitiesDone: number): boolean {
  if (activitiesDone <= 0) return false;
  return accuracy == null || accuracy >= 0.6;
}

/** Push subscriptions carry the server key as URL-safe base64. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The week planner's untouched server default window (StudyPlan windowStart/windowEnd). */
export const PLANNER_DEFAULT_WINDOW = { windowStart: "15:00", windowEnd: "19:00" } as const;

/** How long the planner window is when it comes from the study-time answer. */
export const PLANNER_WINDOW_FROM_STUDY_TIME_MIN = 120;

/**
 * The planner study window implied by the habit prompt's "When do you usually
 * study?" answer, or null when the student already chose their own window or
 * free times (never overwritten). The window starts at that time and runs two
 * hours, ending by 23:59.
 */
export function plannerWindowFromStudyTime(
  plan: { windowStart: string; windowEnd: string; availability?: unknown[] | null },
  minute: number,
): { windowStart: string; windowEnd: string } | null {
  if (Array.isArray(plan.availability) && plan.availability.length > 0) return null;
  if (plan.windowStart !== PLANNER_DEFAULT_WINDOW.windowStart || plan.windowEnd !== PLANNER_DEFAULT_WINDOW.windowEnd) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute >= 24 * 60) return null;
  const start = Math.floor(minute);
  const end = Math.min(start + PLANNER_WINDOW_FROM_STUDY_TIME_MIN, 23 * 60 + 59);
  if (end <= start) return null;
  return { windowStart: minuteToTimeInput(start), windowEnd: minuteToTimeInput(end) };
}
