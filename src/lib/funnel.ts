/**
 * First-run funnel events (server: `activity.track`). Answers "what happens in
 * the first 9 seconds": first screen viewed, way in chosen, upload
 * started/finished, Quick 5 started/finished — with viewport width and touch
 * so phone and desktop can be told apart. Fire-and-forget: a failed or slow
 * request never affects the page, and `keepalive` lets an event sent while
 * the tab closes still arrive.
 */
import { apiUrl } from "./api/config";
import type { WallReason, WallVariant } from "./wall";

export type FunnelEvent =
  | "first_run.viewed"
  | "first_run.option_chosen"
  | "first_run.upload_started"
  | "first_run.upload_finished"
  | "first_run.upload_failed"
  | "first_run.session_requested"
  | "first_run.wait_viewed"
  | "first_run.left_while_waiting"
  | "quick5.started"
  | "quick5.finished"
  /** Home's one "Today" button was tapped; `action` says which one it was. */
  | "home.today_tapped"
  /** A note opened in the in-app reader; notes attached to / removed from a subject; a session started from an attached note. */
  | "notes.opened_in_app"
  | "notes.attached"
  | "notes.detached"
  | "notes.attached_session_started"
  /** First run: Scribe's notes for the picked course offered, taken, or passed over. */
  | "first_run.notes_offered"
  | "first_run.notes_accepted"
  | "first_run.notes_skipped"
  /** End screen: the one next step was tapped; `kind` says which. */
  | "debrief.next_tapped"
  /** The player's bottom-bar Next (against the card's own "Next question"). */
  | "session.footer_next"
  /** "How Scribe works" opened by hand, then closed after `seconds`. */
  | "tour.shown"
  | "tour.closed"
  /** A search ran; `hasLocalResults` says whether the free local index found anything. */
  | "search.query"
  /** Subscribe wall: shown (`reason`, `variant`), dismissed, or checkout opened from it (a trial, or the pass when `variant` is "exam_pass"). */
  | "wall.shown"
  | "wall.dismissed"
  | "wall.trial_started"
  /** Coursework grader screen opened (the server records review_requested / review_completed / limit_hit itself). */
  | "grader.opened";

/** What the end screen's next step offered (the server's DEBRIEF_NEXT_KINDS). */
export type DebriefNextKind = "session" | "quick5" | "mistakes" | "topic" | "review" | "plan" | "home" | "other";

/** Where a notes event happened. */
export type NoteEventSource = "library" | "course" | "subject" | "note" | "public" | "first_run";

export type TodayActionKind = "mistakes" | "plan" | "quick5" | "upload" | "continue";

export type FirstRunOption = "upload" | "camera" | "topic" | "paste" | "curriculum" | "skip";

export interface FunnelProps {
  option?: FirstRunOption;
  action?: TodayActionKind;
  durationMs?: number;
  fileCount?: number;
  sizeKb?: number;
  correct?: number;
  total?: number;
  from?: NoteEventSource;
  noteCount?: number;
  /** A catalog course id (the server accepts only known ids). */
  courseId?: string;
  /** debrief.next_tapped: what the next step offered. */
  kind?: DebriefNextKind;
  /** tour.closed: seconds the tour was open. */
  seconds?: number;
  /** search.query: the free local index returned at least one row. */
  hasLocalResults?: boolean;
  /** wall.*: why the wall opened (server WALL_REASONS). */
  reason?: WallReason;
  /** wall.*: which wall layout (server WALL_VARIANTS). */
  variant?: WallVariant;
}

const FIRST_SCREEN_KEY = "scribe.firstRun.shownAt";

/** Remembers when this tab first showed the first-run screen (kept across navigations). */
export function markFirstScreenShown(now = Date.now()): void {
  try {
    if (!sessionStorage.getItem(FIRST_SCREEN_KEY)) sessionStorage.setItem(FIRST_SCREEN_KEY, String(now));
  } catch {
    /* storage blocked */
  }
}

function msSinceFirstScreen(now: number): number | undefined {
  try {
    const raw = sessionStorage.getItem(FIRST_SCREEN_KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) ? clampMs(now - at) : undefined;
  } catch {
    return undefined;
  }
}

/** Whole, non-negative ms capped at a day (the server's bound). */
export function clampMs(ms: number): number {
  return Math.min(86_400_000, Math.max(0, Math.round(ms)));
}

/** The request body for one event (exported for tests). */
export function funnelPayload(
  event: FunnelEvent,
  props: FunnelProps,
  env: { now: number; viewportWidth?: number; touch?: boolean; sinceFirstScreen?: number },
  workspaceId?: string,
) {
  const clean: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    clean[key] = typeof value === "number" ? (key === "durationMs" ? clampMs(value) : Math.max(0, Math.round(value))) : value;
  }
  if (env.sinceFirstScreen !== undefined) clean.msSinceFirstScreen = clampMs(env.sinceFirstScreen);
  if (env.viewportWidth !== undefined) clean.viewportWidth = Math.min(10_000, Math.max(0, Math.round(env.viewportWidth)));
  if (env.touch !== undefined) clean.touch = env.touch;
  return { event, ...(workspaceId ? { workspaceId } : {}), props: clean };
}

export function track(event: FunnelEvent, props: FunnelProps = {}, workspaceId?: string): void {
  if (typeof window === "undefined" || !apiUrl) return;
  // Fire-and-forget, and nothing here may throw: callers track right before a
  // navigation or upload, and a failed or rejected (400) event must never stop the tap.
  try {
    const now = Date.now();
    const body = funnelPayload(
      event,
      props,
      {
        now,
        viewportWidth: window.innerWidth,
        touch: typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : undefined,
        sinceFirstScreen: msSinceFirstScreen(now),
      },
      workspaceId,
    );
    void fetch(`${apiUrl}/trpc/activity.track`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "content-type": "application/json" },
      // superjson envelope for plain JSON input.
      body: JSON.stringify({ json: body }),
    }).catch(() => {});
  } catch {
    /* never let analytics break the page */
  }
}
