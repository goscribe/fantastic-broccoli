"use client";

import { useEffect, useRef } from "react";
import { sendGtagEvent } from "@/lib/gtag";

/**
 * Product analytics: one `track()` for funnel and interaction events.
 *
 * Every event fans out to:
 * - the GA4 property through the existing Google tag, when
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID is set;
 * - NEXT_PUBLIC_ANALYTICS_ENDPOINT as batched JSON beacons, when set
 *   (`POST {events: AnalyticsEvent[]}`);
 * - an in-page ring buffer (`window.__scribeAnalytics`), logged to the
 *   console in development or when localStorage `scribe_analytics_debug=1`.
 *
 * Naming: object_action snake_case. Keep the event list short — put detail
 * (screen, cta id, method, error…) in props instead of new event names.
 */

export type AnalyticsEventName =
  | "page_viewed"
  | "screen_viewed"
  | "cta_clicked"
  | "upload_picker_opened"
  | "upload_picker_cancelled"
  | "upload_started"
  | "upload_completed"
  | "upload_failed"
  | "pack_generation_completed"
  | "pack_generation_failed"
  | "study_session_started"
  | "study_session_ended"
  | "reminder_offer_shown"
  | "reminder_opt_in"
  | "next_session_scheduled"
  | "reminder_opened"
  | "review_ready_shown"
  | "calendar_import_started"
  | "calendar_import_completed"
  | "calendar_import_failed"
  | "calendar_events_parsed"
  | "calendar_event_kind_changed"
  | "study_plan_shown"
  | "study_session_planned"
  | "study_session_accepted"
  | "planned_session_opened";

export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  props: AnalyticsProps;
  ts: string;
  anonymous_id: string;
  tab_id: string;
  user_id?: string;
  page_name: string;
  path: string;
}

declare global {
  interface Window {
    __scribeAnalytics?: AnalyticsEvent[];
  }
}

const ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ?? "";
const ANON_ID_KEY = "scribe_anon_id";
const TAB_ID_KEY = "scribe_tab_id";
const DEBUG_KEY = "scribe_analytics_debug";
const BUFFER_SIZE = 200;
const FLUSH_AT = 10;
const FLUSH_INTERVAL_MS = 5000;

let userId: string | undefined;
let currentPage: { name: string; path: string } | null = null;
let previousPageName: string | undefined;
let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function persistentId(storage: () => Storage, key: string): string {
  try {
    const store = storage();
    const existing = store.getItem(key);
    if (existing) return existing;
    const id = randomId();
    store.setItem(key, id);
    return id;
  } catch {
    return "unavailable";
  }
}

function debugEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/$/, "home"],
  [/^\/workspace\/[^/]+\/session\/[^/]+$/, "study_session"],
  [/^\/workspace\/[^/]+\/bank\/[^/]+$/, "workspace_bank_item"],
  [/^\/workspace\/[^/]+\/([a-z-]+)$/, "workspace_$1"],
  [/^\/workspace\/[^/]+$/, "workspace"],
  [/^\/folder\/[^/]+$/, "folder"],
  [/^\/flashcards\/review$/, "flashcards_review"],
  [/^\/flashcards\/[^/]+$/, "flashcard_deck"],
  [/^\/landing\/blog\/[^/]+$/, "landing_blog_post"],
  [/^\/admin\/workspaces\/[^/]+$/, "admin_workspace"],
];

/** Stable, id-free page name for a pathname (`/workspace/x/study` → `workspace_study`). */
export function pageNameFor(pathname: string): string {
  for (const [re, name] of PAGE_NAMES) {
    if (re.test(pathname)) return pathname.replace(re, name).replace(/-/g, "_");
  }
  return pathname.replace(/^\/+|\/+$/g, "").replace(/[/-]+/g, "_") || "home";
}

export function setAnalyticsUser(id: string | undefined): void {
  userId = id;
}

function flush(useBeacon = false): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!ENDPOINT || queue.length === 0) return;
  const body = JSON.stringify({ events: queue });
  queue = [];
  try {
    if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics is best-effort; never break the app.
  }
}

function enqueue(event: AnalyticsEvent): void {
  if (!ENDPOINT) return;
  queue.push(event);
  if (queue.length >= FLUSH_AT) flush();
  else if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
}

export function track(event: AnalyticsEventName, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const record: AnalyticsEvent = {
    event,
    props,
    ts: new Date().toISOString(),
    anonymous_id: persistentId(() => localStorage, ANON_ID_KEY),
    tab_id: persistentId(() => sessionStorage, TAB_ID_KEY),
    user_id: userId,
    page_name: currentPage?.name ?? pageNameFor(path),
    path,
  };

  const buffer = (window.__scribeAnalytics ??= []);
  buffer.push(record);
  if (buffer.length > BUFFER_SIZE) buffer.splice(0, buffer.length - BUFFER_SIZE);
  if (debugEnabled()) console.debug("[analytics]", event, props);

  sendGtagEvent(event, {
    ...props,
    page_name: record.page_name,
    ...(userId ? { user_id: userId } : {}),
  });
  enqueue(record);
}

/** Fires `page_viewed` when the pathname changes (query-only changes are ignored). */
export function trackPageView(pathname: string): void {
  if (currentPage?.path === pathname) return;
  previousPageName = currentPage?.name;
  currentPage = { name: pageNameFor(pathname), path: pathname };
  const params = new URLSearchParams(window.location.search);
  const referrer =
    !previousPageName && document.referrer && !document.referrer.includes(window.location.hostname)
      ? document.referrer.slice(0, 200)
      : undefined;
  track("page_viewed", {
    page_name: currentPage.name,
    prev_page_name: previousPageName,
    src: params.get("src") ?? undefined,
    referrer,
  });
}

export type CtaPosition = "primary" | "secondary" | "tertiary";

/**
 * Data attributes that make any clickable element report `cta_clicked`
 * (picked up by the document-level listener). Use `TrackedButton` for
 * buttons; spread this onto links and custom clickables.
 */
export function ctaProps(id: string, position?: CtaPosition, label?: string) {
  return {
    "data-cta-id": id,
    ...(position ? { "data-cta-position": position } : {}),
    ...(label ? { "data-cta-label": label } : {}),
  };
}

/** Marks a region as a named screen; CTAs inside report it as `screen`. */
export function screenProps(name: string) {
  return { "data-screen": name };
}

/** Document-level click delegation for `[data-cta-id]`. Returns a cleanup. */
export function installAnalyticsListeners(): () => void {
  const onClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    const el = target?.closest?.("[data-cta-id]") as HTMLElement | null;
    if (!el) return;
    const label =
      el.dataset.ctaLabel ??
      (el.textContent?.replace(/\s+/g, " ").trim() || el.getAttribute("aria-label") || "");
    track("cta_clicked", {
      cta_id: el.dataset.ctaId,
      cta_label: label.slice(0, 80),
      cta_position: el.dataset.ctaPosition,
      screen:
        el.closest<HTMLElement>("[data-screen]")?.dataset.screen ??
        currentPage?.name ??
        pageNameFor(window.location.pathname),
    });
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true);
  };
  const onPageHide = () => flush(true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
  };
}

/** Fires an event once per mount, the first time `enabled` is true. */
export function useTrackOnce(
  event: AnalyticsEventName,
  props: AnalyticsProps,
  enabled = true,
): void {
  const fired = useRef(false);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!enabled || fired.current) return;
    fired.current = true;
    track(event, latest.current);
  }, [enabled, event]);
}

export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 150);
}
