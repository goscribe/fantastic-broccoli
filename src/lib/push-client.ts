"use client";

/**
 * Browser side of web push: the service worker (public/sw.js), this device's
 * subscription, and the Android install prompt. Every function is safe to call
 * where the APIs don't exist (it just does nothing).
 */
import { useSyncExternalStore } from "react";
import { remindersApi } from "@/lib/api/reminders";
import { urlBase64ToUint8Array } from "@/lib/reminders";

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
    const reg = await registration();
    if (!reg || !("Notification" in window)) return "failed";
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
export function readDeviceSeen(): { iosInstallHint: boolean; androidInstall: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, boolean>;
    return { iosInstallHint: !!raw.iosInstallHint, androidInstall: !!raw.androidInstall };
  } catch {
    return { iosInstallHint: false, androidInstall: false };
  }
}
export function markDeviceSeen(key: "iosInstallHint" | "androidInstall"): void {
  try {
    const cur = readDeviceSeen();
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...cur, [key]: true }));
  } catch {
    // Storage blocked: may show again, which is harmless.
  }
}
