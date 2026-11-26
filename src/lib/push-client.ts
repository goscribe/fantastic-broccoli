"use client";

/**
 * Browser side of web push: the service worker (public/sw.js), this device's
 * subscription, and the Android install prompt. Every function is safe to call
 * where the APIs don't exist (it just does nothing).
 */
import { useSyncExternalStore } from "react";
import { remindersApi } from "@/lib/api/reminders";
import { deviceSeenFor, isUsableVapidKey, urlBase64ToUint8Array, type DeviceSeen, type StoredDeviceSeen } from "@/lib/reminders";

const SW_URL = "/sw.js";

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" }).catch(() => null);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await registration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

function toServer(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

/**
 * Asks the browser for permission (must run inside a tap) and saves the
 * subscription on the server. "granted" when this device will get pushes.
 */
export async function enablePush(vapidPublicKey: string): Promise<"granted" | "denied" | "failed"> {
  try {
    // Without a usable server key the subscribe below can only throw: don't open the browser's prompt for it.
    if (!isUsableVapidKey(vapidPublicKey)) return "failed";
    const reg = await registration();
    if (!reg || !("PushManager" in window) || !("Notification" in window)) return "failed";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "failed";
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
    await remindersApi.subscribePush(toServer(sub));
    return "granted";
  } catch {
    return "failed";
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await remindersApi.unsubscribePush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

let synced = false;
/**
 * Once per page load for a signed-in learner: register the worker and, if
 * this browser already has a subscription, re-send it (browsers rotate them;
 * the server upserts by endpoint).
 */
export function syncPushSubscription(): void {
  if (synced || typeof window === "undefined") return;
  synced = true;
  void (async () => {
    await registerServiceWorker();
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const sub = await currentPushSubscription();
    if (sub) await remindersApi.subscribePush(toServer(sub)).catch(() => undefined);
  })();
}

// ── Android / desktop Chrome install prompt ─────────────────────────────────
// `beforeinstallprompt` fires once, early; keep it until a Quick 5 is done.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((l) => l());

let capturing = false;
export function captureInstallPrompt(): void {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's mini-infobar away; we offer it after a Quick 5.
    e.preventDefault();
    deferredInstall = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    notifyInstall();
  });
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (l) => {
      installListeners.add(l);
      return () => installListeners.delete(l);
    },
    () => deferredInstall !== null,
    () => false,
  );
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferredInstall;
  if (!e) return "unavailable";
  deferredInstall = null;
  notifyInstall();
  try {
    await e.prompt();
    return (await e.userChoice).outcome;
  } catch {
    return "unavailable";
  }
}

// ── Per-device "shown once" markers ─────────────────────────────────────────

const SEEN_KEY = "scribe.habit-seen";
const currentUserAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

/** This device's markers; cleared when the user agent changed since they were set. */
export function readDeviceSeen(): DeviceSeen {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as StoredDeviceSeen;
    return deviceSeenFor(raw, currentUserAgent());
  } catch {
    return { iosInstallHint: false, androidInstall: false };
  }
}
export function markDeviceSeen(key: keyof DeviceSeen): void {
  try {
    const next: StoredDeviceSeen = { ...readDeviceSeen(), [key]: true, ua: currentUserAgent() };
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: may show again, which is harmless.
  }
}

// ── One ask per visit ───────────────────────────────────────────────────────
// The end-screen asks (study time, push, install hints) show at most once
// between opening the app and closing the tab, however many sessions are
// finished. Kept in memory too, for browsers that block sessionStorage.

const VISIT_KEY = "scribe.reminder-ask.shown";
let askedInMemory = false;

export function askedThisVisit(): boolean {
  if (askedInMemory) return true;
  try {
    return window.sessionStorage.getItem(VISIT_KEY) === "1";
  } catch {
    return false;
  }
}
export function markAskedThisVisit(): void {
  askedInMemory = true;
  try {
    window.sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // Storage blocked: the in-memory flag covers this page load.
  }
}

/** The browser's IANA zone, sent with the study time so the reminder goes out at that local time. */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
