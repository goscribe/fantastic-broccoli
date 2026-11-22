/**
 * Study-time reminders and the one-time prompts after a Quick 5 ("When do
 * you usually study?", the push soft-ask, the install hints). Pure: no React
 * or API imports, so the decisions can be unit tested.
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

/** Whether this browser can ask for push permission right now. */
export function canAskPush(prefs: ReminderPrefs, platform: Platform): boolean {
  return (
    prefs.pushAvailable &&
    !!prefs.vapidPublicKey &&
    platform.pushSupported &&
    platform.permission === "default" &&
    // iOS only delivers web push to the home-screen app.
    (!platform.ios || platform.standalone)
  );
}

/**
 * The prompts to show after a finished Quick 5, in order, at most two per
 * visit: the study-time question (once per account), then one of the push
 * soft-ask (once per account), the iOS "Add to Home Screen" hint (once per
 * device, only after a good session) or the Android install offer (once per
 * device). Whatever isn't shown now comes after a later Quick 5.
 */
export function habitSteps(input: {
  prefs: ReminderPrefs;
  platform: Platform;
  seen: DeviceSeen;
  /** Finished with a decent score; the iOS hint waits for one. */
  goodSession: boolean;
}): HabitStep[] {
  const { prefs, platform, seen, goodSession } = input;
  const steps: HabitStep[] = [];
  if (!prefs.studyTimeAsked) steps.push("study_time");
  if (!prefs.pushAsked && canAskPush(prefs, platform)) {
    steps.push("push");
  } else if (platform.ios && !platform.standalone && !seen.iosInstallHint && goodSession) {
    steps.push("ios_install");
  } else if (!platform.ios && !platform.standalone && platform.canInstall && !seen.androidInstall) {
    steps.push("android_install");
  }
  return steps.slice(0, 2);
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
